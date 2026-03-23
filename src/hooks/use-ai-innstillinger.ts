"use client";

/**
 * AI-innstillinger — konfidensterskel og auto-postering (#94)
 *
 * Lagring: users/{uid}/innstillinger/ai
 *
 * Konfidensterskelen bestemmer om AI-forslag auto-bokføres:
 * - >= terskel  → auto-bokfør uten manuell godkjenning
 * - < terskel   → plasser i manuell review-kø (status: "foreslått")
 * - reviewAll   → send alt til manuell review uansett konfidens
 */

import { useState, useEffect, useCallback } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/firestore";

export type AiInnstillinger = {
  /** Konfidens-terskel (0–100). Forslag med konfidens ≥ terskel auto-bokføres. */
  konfidensterskel: number;
  /** Om ALL auto-bokføring er deaktivert — alt sendes til review */
  reviewAll: boolean;
  /** Maksimalt beløp som kan auto-bokføres (NOK). 0 = ingen grense. */
  maxAutoBeløp: number;
  /** Kontoer som ALDRI auto-bokføres (krever alltid review) */
  kritiskeKontoer: string[];
};

const DEFAULT: AiInnstillinger = {
  konfidensterskel: 85,
  reviewAll: false,
  maxAutoBeløp: 50_000,
  kritiskeKontoer: ["2400", "2600", "2700", "2800"],
};

export function useAiInnstillinger(userId: string | null) {
  const [innstillinger, setInnstillinger] = useState<AiInnstillinger>(DEFAULT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setInnstillinger(DEFAULT);
      setLoading(false);
      return;
    }

    const ref = doc(db, "users", userId, "innstillinger", "ai");
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setInnstillinger({ ...DEFAULT, ...snap.data() } as AiInnstillinger);
      } else {
        setInnstillinger(DEFAULT);
      }
      setLoading(false);
    });

    return () => unsub();
  }, [userId]);

  const oppdater = useCallback(
    async (data: Partial<AiInnstillinger>) => {
      if (!userId) return;
      const ref = doc(db, "users", userId, "innstillinger", "ai");
      await setDoc(ref, { ...innstillinger, ...data }, { merge: true });
    },
    [userId, innstillinger]
  );

  /**
   * Sjekk om et AI-forslag bør auto-bokføres basert på innstillingene.
   *
   * @returns true hvis forslaget kan auto-bokføres
   */
  const skalAutoBokføre = useCallback(
    (konfidens: number, beløp: number, kontoer: string[]): boolean => {
      if (innstillinger.reviewAll) return false;

      // Under terskel → review
      if (konfidens * 100 < innstillinger.konfidensterskel) return false;

      // Over maks-beløp → review
      if (innstillinger.maxAutoBeløp > 0 && Math.abs(beløp) > innstillinger.maxAutoBeløp) return false;

      // Kritiske kontoer → review
      if (kontoer.some((k) => innstillinger.kritiskeKontoer.includes(k))) return false;

      return true;
    },
    [innstillinger]
  );

  return { innstillinger, loading, oppdater, skalAutoBokføre };
}
