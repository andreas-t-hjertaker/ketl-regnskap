"use client";

/**
 * Bankkontoavstemming — importer banktransaksjoner og match mot bilag
 *
 * Støtter:
 * - Import av CSV fra norske banker (DNB, Nordea, Sparebank 1, Handelsbanken)
 * - Automatisk matching basert på beløp ± dato (±3 dager)
 * - Manuell kobling av transaksjon ↔ bilag
 * - Statusoversikt: matchet, umatchet, manuelt koblet
 *
 * Banktransaksjoner lagres i: users/{uid}/banktransaksjoner/{id}
 * og er ikke en del av det juridiske regnskapet — kun hjelpedata.
 */

import { useState, useEffect, useCallback } from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase/firestore";
import type { BilagMedId } from "@/hooks/use-bilag";

export type BankTransaksjon = {
  dato: string;           // ISO date
  beskrivelseBank: string; // Tekst fra banken
  beløp: number;          // Positivt = inn, negativt = ut
  saldo?: number;
  referanse?: string;     // Bankens referansenr.
  status: "umatchet" | "matchet" | "manuelt_koblet" | "ignorert";
  bilagId?: string;       // Koblet bilag
  importertDato: unknown; // serverTimestamp
};

export type BankTransaksjonMedId = BankTransaksjon & { id: string };

/** Norske bank-CSV-parsere */
export function parseBankCSV(tekst: string): Omit<BankTransaksjon, "status" | "importertDato">[] {
  const linjer = tekst.trim().split(/\r?\n/);
  if (linjer.length < 2) return [];

  const header = linjer[0].toLowerCase();
  const rader = linjer.slice(1);

  // ─── DNB-format ───────────────────────────────────────────
  // "Dato";"Forklaring";"Rentedato";"Ut fra konto";"Inn på konto"
  if (header.includes("forklaring") && header.includes("rentedato")) {
    return rader.flatMap((rad) => {
      const felt = rad.split(";").map((f) => f.replace(/^"|"$/g, "").trim());
      const dato = felt[0]?.split(".").reverse().join("-"); // DD.MM.YYYY → YYYY-MM-DD
      const beskrivelse = felt[1] ?? "";
      const ut = parseFloat((felt[3] ?? "0").replace(/\s/g, "").replace(",", ".")) || 0;
      const inn = parseFloat((felt[4] ?? "0").replace(/\s/g, "").replace(",", ".")) || 0;
      const beløp = inn > 0 ? inn : -ut;
      if (!dato || !beskrivelse || beløp === 0) return [];
      return [{ dato, beskrivelseBank: beskrivelse, beløp, referanse: undefined }];
    });
  }

  // ─── Nordea / Sparebank 1-format ──────────────────────────
  // "Bokføringsdato";"Beløp";"Avsender";"Mottaker";"Navn";"Tittel";"Valuta";"saldo"
  if (header.includes("bokføringsdato") || header.includes("bokkføringsdato")) {
    return rader.flatMap((rad) => {
      const felt = rad.split(";").map((f) => f.replace(/^"|"$/g, "").trim());
      const dato = felt[0]?.split(".").reverse().join("-");
      const beløp = parseFloat((felt[1] ?? "0").replace(/\s/g, "").replace(",", ".")) || 0;
      const beskrivelse = [felt[4], felt[5]].filter(Boolean).join(" — ").trim() || felt[2] || "—";
      const saldo = parseFloat((felt[7] ?? "").replace(/\s/g, "").replace(",", ".")) || undefined;
      if (!dato || beløp === 0) return [];
      return [{ dato, beskrivelseBank: beskrivelse, beløp, saldo }];
    });
  }

  // ─── Handelsbanken-format ──────────────────────────────────
  // Date;Text;Amount;Balance
  if (header.startsWith("date;text") || header.startsWith('"date";"text"')) {
    return rader.flatMap((rad) => {
      const felt = rad.split(";").map((f) => f.replace(/^"|"$/g, "").trim());
      const dato = felt[0];  // allerede YYYY-MM-DD
      const beskrivelse = felt[1] ?? "—";
      const beløp = parseFloat((felt[2] ?? "0").replace(/\s/g, "").replace(",", ".")) || 0;
      const saldo = parseFloat((felt[3] ?? "").replace(/\s/g, "").replace(",", ".")) || undefined;
      if (!dato || beløp === 0) return [];
      return [{ dato, beskrivelseBank: beskrivelse, beløp, saldo }];
    });
  }

  return [];
}

/** Finn mulige bilag-match basert på beløp og dato (±3 dager) */
export function finnMatchKandidater(
  transaksjon: BankTransaksjonMedId,
  bilag: BilagMedId[]
): BilagMedId[] {
  const absBeløp = Math.abs(transaksjon.beløp);
  const tDato = new Date(transaksjon.dato).getTime();
  const dagMs = 3 * 24 * 60 * 60 * 1000;

  return bilag.filter((b) => {
    if (b.status !== "bokført" && b.status !== "kreditert") return false;
    if (Math.abs(Math.abs(b.belop) - absBeløp) > 1) return false;
    const bDato = new Date(b.dato).getTime();
    return Math.abs(bDato - tDato) <= dagMs;
  });
}

export function useBankAvstemming(uid: string | null) {
  const [transaksjoner, setTransaksjoner] = useState<BankTransaksjonMedId[]>([]);
  const [loading, setLoading] = useState(true);

  const path = uid ? `users/${uid}/banktransaksjoner` : null;

  useEffect(() => {
    if (!path) {
      setTransaksjoner([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(collection(db, path), orderBy("dato", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setTransaksjoner(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as BankTransaksjonMedId))
      );
      setLoading(false);
    });
    return () => unsub();
  }, [path]);

  const importerTransaksjoner = useCallback(
    async (nye: Omit<BankTransaksjon, "status" | "importertDato">[]): Promise<number> => {
      if (!uid || !path) return 0;
      let antall = 0;
      for (const t of nye) {
        await addDoc(collection(db, path), {
          ...t,
          status: "umatchet",
          importertDato: serverTimestamp(),
        });
        antall++;
      }
      return antall;
    },
    [uid, path]
  );

  const kobleTransaksjon = useCallback(
    async (transaksjonsId: string, bilagId: string): Promise<void> => {
      if (!uid || !path) return;
      await updateDoc(doc(db, path, transaksjonsId), {
        status: "manuelt_koblet",
        bilagId,
      });
    },
    [uid, path]
  );

  const automatchTransaksjoner = useCallback(
    async (bilag: BilagMedId[]): Promise<number> => {
      if (!uid || !path) return 0;
      let matchet = 0;
      for (const t of transaksjoner.filter((t) => t.status === "umatchet")) {
        const kandidater = finnMatchKandidater(t, bilag);
        if (kandidater.length === 1) {
          await updateDoc(doc(db, path, t.id), {
            status: "matchet",
            bilagId: kandidater[0].id,
          });
          matchet++;
        }
      }
      return matchet;
    },
    [uid, path, transaksjoner]
  );

  const ignorer = useCallback(
    async (id: string): Promise<void> => {
      if (!uid || !path) return;
      await updateDoc(doc(db, path, id), { status: "ignorert" });
    },
    [uid, path]
  );

  const slettAlle = useCallback(
    async (): Promise<void> => {
      if (!uid || !path) return;
      for (const t of transaksjoner) {
        await deleteDoc(doc(db, path, t.id));
      }
    },
    [uid, path, transaksjoner]
  );

  const statistikk = {
    totalt: transaksjoner.length,
    matchet: transaksjoner.filter((t) => t.status === "matchet" || t.status === "manuelt_koblet").length,
    umatchet: transaksjoner.filter((t) => t.status === "umatchet").length,
    ignorert: transaksjoner.filter((t) => t.status === "ignorert").length,
  };

  return {
    transaksjoner,
    loading,
    statistikk,
    importerTransaksjoner,
    kobleTransaksjon,
    automatchTransaksjoner,
    ignorer,
    slettAlle,
  };
}
