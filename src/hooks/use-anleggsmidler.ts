"use client";

/**
 * Anleggsmiddelregister — avskrivninger og periodisering (#87)
 *
 * Lagring: users/{uid}/klienter/{klientId}/anleggsmidler/{id}
 *
 * Støtter lineær avskrivning og saldobasert avskrivning (saldometoden).
 */

import { useState, useEffect, useCallback } from "react";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/firestore";
import type { Anleggsmiddel, Avskrivningslinje } from "@/types";

export type AnleggsmiddelMedId = Anleggsmiddel & { id: string };

/** Beregner avskrivningsplan for et anleggsmiddel */
export function beregnAvskrivningsplan(a: Anleggsmiddel): Avskrivningslinje[] {
  const startÅr = new Date(a.anskaffetDato).getFullYear();
  const linjer: Avskrivningslinje[] = [];

  if (a.metode === "lineær") {
    const restverdi = a.restverdi ?? 0;
    const avskrivbarBelop = a.kostpris - restverdi;
    const årsavskrivning = avskrivbarBelop / a.levetidÅr;

    let akkumulert = 0;
    for (let i = 0; i < a.levetidÅr; i++) {
      akkumulert += årsavskrivning;
      linjer.push({
        år: startÅr + i,
        avskrivning: årsavskrivning,
        akkumulertAvskrivning: akkumulert,
        bokførtVerdi: a.kostpris - akkumulert,
      });
    }
  } else {
    // Saldobasert: avskrivningsprosent av gjenstående bokført verdi
    const sats = (a.saldoSats ?? 20) / 100;
    let bokførtVerdi = a.kostpris;
    let akkumulert = 0;
    const minVerdi = a.restverdi ?? 0;

    for (let i = 0; i < a.levetidÅr; i++) {
      const avskrivning = Math.max(bokførtVerdi * sats, 0);
      const justertAvskrivning = Math.max(
        Math.min(avskrivning, bokførtVerdi - minVerdi),
        0
      );
      akkumulert += justertAvskrivning;
      bokførtVerdi -= justertAvskrivning;

      linjer.push({
        år: startÅr + i,
        avskrivning: justertAvskrivning,
        akkumulertAvskrivning: akkumulert,
        bokførtVerdi,
      });

      if (bokførtVerdi <= minVerdi) break;
    }
  }

  return linjer;
}

/** Beregner årets avskrivning for et anleggsmiddel */
export function årsavskrivning(a: Anleggsmiddel, år: number): number {
  const plan = beregnAvskrivningsplan(a);
  return plan.find((l) => l.år === år)?.avskrivning ?? 0;
}

export function useAnleggsmidler(userId: string | null, klientId: string | null) {
  const [anleggsmidler, setAnleggsmidler] = useState<AnleggsmiddelMedId[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !klientId) {
      setAnleggsmidler([]);
      setLoading(false);
      return;
    }

    const ref = collection(db, "users", userId, "klienter", klientId, "anleggsmidler");
    const q = query(ref, where("aktivert", "==", true));

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        opprettet: d.data().opprettet?.toDate?.() ?? new Date(),
      })) as AnleggsmiddelMedId[];
      setAnleggsmidler(data.sort((a, b) => a.navn.localeCompare(b.navn)));
      setLoading(false);
    });

    return () => unsub();
  }, [userId, klientId]);

  const leggTil = useCallback(
    async (data: Omit<Anleggsmiddel, "opprettet" | "aktivert" | "klientId">) => {
      if (!userId || !klientId) return;
      const ref = collection(db, "users", userId, "klienter", klientId, "anleggsmidler");
      await addDoc(ref, {
        ...data,
        klientId,
        aktivert: true,
        opprettet: serverTimestamp(),
      });
    },
    [userId, klientId]
  );

  const oppdater = useCallback(
    async (id: string, data: Partial<Anleggsmiddel>) => {
      if (!userId || !klientId) return;
      const ref = doc(db, "users", userId, "klienter", klientId, "anleggsmidler", id);
      await updateDoc(ref, data);
    },
    [userId, klientId]
  );

  const slett = useCallback(
    async (id: string) => {
      if (!userId || !klientId) return;
      const ref = doc(db, "users", userId, "klienter", klientId, "anleggsmidler", id);
      await deleteDoc(ref);
    },
    [userId, klientId]
  );

  return { anleggsmidler, loading, leggTil, oppdater, slett };
}
