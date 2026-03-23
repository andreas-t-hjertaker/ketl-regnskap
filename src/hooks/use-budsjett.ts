"use client";

/**
 * Budsjettering — årsbudsjett per klient (#89)
 *
 * Lagring: users/{uid}/klienter/{klientId}/budsjett/{år}
 *
 * Hvert dokument har en `linjer`-array med budsjett per kontonr.
 * Faktiske tall hentes fra bilag-posteringer og sammenlignes.
 */

import { useState, useEffect, useCallback } from "react";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase/firestore";
import type { BudsjettLinje } from "@/types";

export type BudsjettMedId = {
  år: number;
  klientId: string;
  linjer: BudsjettLinje[];
};

export function useBudsjett(userId: string | null, klientId: string | null, år: number) {
  const [budsjett, setBudsjett] = useState<BudsjettMedId | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hent = useCallback(async () => {
    if (!userId || !klientId) {
      setBudsjett(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const ref = doc(db, "users", userId, "klienter", klientId, "budsjett", String(år));
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        setBudsjett({
          år: data.år as number,
          klientId: data.klientId as string,
          linjer: (data.linjer ?? []) as BudsjettLinje[],
        });
      } else {
        setBudsjett({ år, klientId, linjer: [] });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [userId, klientId, år]);

  useEffect(() => {
    hent();
  }, [hent]);

  const lagre = useCallback(
    async (linjer: BudsjettLinje[]) => {
      if (!userId || !klientId) return;
      const ref = doc(db, "users", userId, "klienter", klientId, "budsjett", String(år));
      await setDoc(ref, {
        år,
        klientId,
        linjer,
        oppdatert: serverTimestamp(),
        opprettet: serverTimestamp(),
      }, { merge: true });
      setBudsjett({ år, klientId, linjer });
    },
    [userId, klientId, år]
  );

  return { budsjett, loading, error, lagre };
}
