"use client";

import { useState, useEffect, useCallback } from "react";
import { orderBy, where, runTransaction, doc, serverTimestamp } from "firebase/firestore";
import {
  subscribeToCollection,
  addDocument,
  updateDocument,
  deleteDocument,
  db,
} from "@/lib/firebase/firestore";
import { loggHandling } from "@/lib/audit";
import { showToast } from "@/lib/toast";
import { nestebilagsnummer } from "@/lib/firebase/firestore";
import type { Faktura, FakturaLinje, FakturaStatus, Postering } from "@/types";

export type FakturaMedId = Faktura & { id: string };

/** Beregn summer for en fakturalinjesamling */
export function beregnFakturaSummer(linjer: FakturaLinje[]): {
  sumEksMva: number;
  sumMva: number;
  sumInkMva: number;
} {
  let sumEksMva = 0;
  let sumMva = 0;

  for (const linje of linjer) {
    const rabattFaktor = 1 - (linje.rabatt ?? 0) / 100;
    const eksMva = linje.antall * linje.enhetspris * rabattFaktor;
    const mva = eksMva * (linje.mvaSats / 100);
    sumEksMva += eksMva;
    sumMva += mva;
  }

  return {
    sumEksMva: Math.round(sumEksMva * 100) / 100,
    sumMva: Math.round(sumMva * 100) / 100,
    sumInkMva: Math.round((sumEksMva + sumMva) * 100) / 100,
  };
}

/** Hent neste fakturanummer atomisk via Firestore-transaksjon */
async function nesteFakturanummer(uid: string, år: number): Promise<number> {
  const tellerRef = doc(db, `users/${uid}/counters/faktura_${år}`);

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(tellerRef);
    const forrige = snap.exists() ? (snap.data().siste as number) : 10000;
    const neste = forrige + 1;
    tx.set(tellerRef, { siste: neste, oppdatert: serverTimestamp() });
    return neste;
  });
}

export function useFaktura(uid: string | null, klientId?: string | null) {
  const [fakturaer, setFakturaer] = useState<FakturaMedId[]>([]);
  const [loading, setLoading] = useState(true);

  const path = uid ? `users/${uid}/fakturaer` : null;

  useEffect(() => {
    if (!path) {
      setFakturaer([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const constraints = klientId
      ? [where("klientId", "==", klientId), orderBy("dato", "desc")]
      : [orderBy("dato", "desc")];

    const unsubscribe = subscribeToCollection<Faktura>(
      path,
      async (data) => {
        const idag = new Date().toISOString().slice(0, 10);
        // Auto-markere forfalte fakturaer (sendt + forfallsDato passert)
        for (const f of data as FakturaMedId[]) {
          if (f.status === "sendt" && f.forfallsDato < idag) {
            await updateDocument(path, f.id, { status: "forfalt" as FakturaStatus }).catch(() => {});
          }
        }
        setFakturaer(data as FakturaMedId[]);
        setLoading(false);
      },
      ...constraints
    );

    return unsubscribe;
  }, [path, klientId]);

  const opprettFaktura = useCallback(
    async (
      data: Omit<Faktura, "fakturanr" | "fakturanrFormatert" | "sumEksMva" | "sumMva" | "sumInkMva" | "status" | "opprettet">
    ): Promise<string | null> => {
      if (!uid || !path) return null;
      try {
        const år = parseInt(data.dato.slice(0, 4), 10);
        const fakturanr = await nesteFakturanummer(uid, år);
        const fakturanrFormatert = `FF-${år}-${fakturanr}`;
        const summer = beregnFakturaSummer(data.linjer);

        const ref = await addDocument(path, {
          ...data,
          fakturanr,
          fakturanrFormatert,
          ...summer,
          status: "kladd" as FakturaStatus,
          opprettet: new Date(),
        });

        await loggHandling(uid, "faktura_opprettet", "faktura", ref.id, {
          fakturanr,
          fakturanrFormatert,
          kundeNavn: data.kundeNavn,
          belop: summer.sumInkMva,
        });

        showToast.success(`Faktura ${fakturanrFormatert} opprettet`);
        return ref.id;
      } catch (err) {
        console.error("opprettFaktura:", err);
        showToast.error("Klarte ikke opprette faktura");
        return null;
      }
    },
    [uid, path]
  );

  const oppdaterFaktura = useCallback(
    async (id: string, data: Partial<Faktura>): Promise<boolean> => {
      if (!uid || !path) return false;
      try {
        // Beregn summer på nytt hvis linjer endres
        const oppdatering: Partial<Faktura> = { ...data };
        if (data.linjer) {
          const summer = beregnFakturaSummer(data.linjer);
          oppdatering.sumEksMva = summer.sumEksMva;
          oppdatering.sumMva = summer.sumMva;
          oppdatering.sumInkMva = summer.sumInkMva;
        }
        await updateDocument(path, id, oppdatering);
        return true;
      } catch (err) {
        console.error("oppdaterFaktura:", err);
        showToast.error("Klarte ikke oppdatere faktura");
        return false;
      }
    },
    [uid, path]
  );

  const slettFaktura = useCallback(
    async (id: string, fakturanrFormatert: string): Promise<boolean> => {
      if (!uid || !path) return false;
      try {
        await deleteDocument(path, id);
        showToast.success(`Faktura ${fakturanrFormatert} slettet`);
        return true;
      } catch (err) {
        console.error("slettFaktura:", err);
        showToast.error("Klarte ikke slette faktura");
        return false;
      }
    },
    [uid, path]
  );

  const markerSendt = useCallback(
    async (id: string, faktura: FakturaMedId): Promise<boolean> => {
      if (!uid || !path) return false;
      try {
        await updateDocument(path, id, { status: "sendt" as FakturaStatus });
        await loggHandling(uid, "faktura_sendt", "faktura", id, {
          fakturanrFormatert: faktura.fakturanrFormatert,
          kundeNavn: faktura.kundeNavn,
        });
        showToast.success(`${faktura.fakturanrFormatert} markert som sendt`);
        return true;
      } catch (err) {
        console.error("markerSendt:", err);
        showToast.error("Klarte ikke markere som sendt");
        return false;
      }
    },
    [uid, path]
  );

  const markerBetalt = useCallback(
    async (id: string, faktura: FakturaMedId, betaltDato: string): Promise<boolean> => {
      if (!uid || !path) return false;
      try {
        await updateDocument(path, id, {
          status: "betalt" as FakturaStatus,
          betaltDato,
        });
        await loggHandling(uid, "faktura_betalt", "faktura", id, {
          fakturanrFormatert: faktura.fakturanrFormatert,
          kundeNavn: faktura.kundeNavn,
          betaltDato,
          belop: faktura.sumInkMva,
        });
        showToast.success(`${faktura.fakturanrFormatert} markert som betalt`);
        return true;
      } catch (err) {
        console.error("markerBetalt:", err);
        showToast.error("Klarte ikke markere som betalt");
        return false;
      }
    },
    [uid, path]
  );

  const krediterFaktura = useCallback(
    async (id: string, faktura: FakturaMedId): Promise<boolean> => {
      if (!uid || !path) return false;
      try {
        await updateDocument(path, id, { status: "kreditert" as FakturaStatus });
        await loggHandling(uid, "faktura_kreditert", "faktura", id, {
          fakturanrFormatert: faktura.fakturanrFormatert,
          kundeNavn: faktura.kundeNavn,
        });
        showToast.success(`${faktura.fakturanrFormatert} kreditert`);
        return true;
      } catch (err) {
        console.error("krediterFaktura:", err);
        showToast.error("Klarte ikke kreditere faktura");
        return false;
      }
    },
    [uid, path]
  );

  /** Registrer at purring er sendt for en faktura */
  const registrerPurring = useCallback(
    async (id: string, faktura: FakturaMedId): Promise<boolean> => {
      if (!uid || !path) return false;
      try {
        const antall = (faktura.purring?.antall ?? 0) + 1;
        const sistePurringDato = new Date().toISOString().slice(0, 10);
        await updateDocument(path, id, {
          purring: {
            antall,
            sistePurringDato,
            inkasso: antall >= 3,
          },
        });
        showToast.success(`${antall}. purring registrert for ${faktura.fakturanrFormatert}`);
        return true;
      } catch (err) {
        console.error("registrerPurring:", err);
        showToast.error("Klarte ikke registrere purring");
        return false;
      }
    },
    [uid, path]
  );

  /**
   * Bokfør en faktura som bilag i regnskapet.
   * Oppretter:
   *  - Debet 1500 (kundefordring) for sum inkl. MVA
   *  - Kredit 3000 (salgsinntekt) for sum ekskl. MVA
   *  - Kredit 2701 (utgående MVA) for MVA-beløpet
   *
   * Merker fakturaen med bilagId etter bokføring.
   */
  const bokforFaktura = useCallback(
    async (id: string, faktura: FakturaMedId): Promise<string | null> => {
      if (!uid || !path) return null;
      if (faktura.bilagId) {
        showToast.error("Fakturaen er allerede bokført.");
        return null;
      }
      try {
        const bilagPath = `users/${uid}/bilag`;
        const år = parseInt(faktura.dato.slice(0, 4), 10);
        const bilagsnr = await nestebilagsnummer(uid, år);

        const posteringer: Postering[] = [
          {
            kontonr: "1500",
            kontonavn: "Kundefordringer",
            debet: faktura.sumInkMva,
            kredit: 0,
            beskrivelse: `Faktura ${faktura.fakturanrFormatert}`,
          },
        ];

        if (faktura.sumMva > 0) {
          posteringer.push({
            kontonr: "2701",
            kontonavn: "Utgående MVA, høy sats",
            debet: 0,
            kredit: faktura.sumMva,
            mvaKode: "3",
            beskrivelse: `MVA ${faktura.fakturanrFormatert}`,
          });
        }

        posteringer.push({
          kontonr: "3000",
          kontonavn: "Salgsinntekt",
          debet: 0,
          kredit: faktura.sumEksMva,
          mvaKode: faktura.sumMva > 0 ? "3" : "0",
          beskrivelse: `${faktura.kundeNavn} — ${faktura.fakturanrFormatert}`,
        });

        const bilagRef = await addDocument(bilagPath, {
          bilagsnr,
          dato: faktura.dato,
          beskrivelse: `Salgsfaktura ${faktura.fakturanrFormatert} — ${faktura.kundeNavn}`,
          belop: faktura.sumInkMva,
          klientId: faktura.klientId,
          status: "bokført",
          motpartId: faktura.motpartId,
          posteringer,
          forfallsDato: faktura.forfallsDato,
        });

        // Koble faktura til bilag
        await updateDocument(path, id, {
          bilagId: bilagRef.id,
          status: "sendt" as FakturaStatus,
        });

        await loggHandling(uid, "faktura_bokfort", "faktura", id, {
          fakturanrFormatert: faktura.fakturanrFormatert,
          bilagId: bilagRef.id,
          bilagsnr,
        });

        showToast.success(`Faktura ${faktura.fakturanrFormatert} bokført som bilag #${bilagsnr}`);
        return bilagRef.id;
      } catch (err) {
        console.error("bokforFaktura:", err);
        showToast.error("Klarte ikke bokføre faktura");
        return null;
      }
    },
    [uid, path]
  );

  // KPI-tall
  const kladder = fakturaer.filter((f) => f.status === "kladd");
  const sendte = fakturaer.filter((f) => f.status === "sendt");
  const forfalte = fakturaer.filter((f) => f.status === "forfalt");
  const betalte = fakturaer.filter((f) => f.status === "betalt");

  const utestående = [...sendte, ...forfalte].reduce(
    (sum, f) => sum + f.sumInkMva,
    0
  );
  const inntektMtd = betalte.reduce((sum, f) => sum + f.sumInkMva, 0);

  return {
    fakturaer,
    loading,
    kladder,
    sendte,
    forfalte,
    betalte,
    utestående,
    inntektMtd,
    opprettFaktura,
    oppdaterFaktura,
    slettFaktura,
    markerSendt,
    markerBetalt,
    krediterFaktura,
    bokforFaktura,
    registrerPurring,
  };
}
