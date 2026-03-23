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
import type { Faktura, FakturaLinje, FakturaStatus } from "@/types";

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
      (data) => {
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
  };
}
