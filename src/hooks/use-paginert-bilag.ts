"use client";

/**
 * Cursor-basert paginering for bilaglisten (#105).
 *
 * Bruker Firestore startAfter() / limit() for å unngå at alle dokumenter
 * lastes inn simultaneously. Henter PAGE_SIZE=50 bilag om gangen.
 *
 * Eksisterende use-bilag.ts beholdes for sub-systemer som trenger alle bilag
 * (rapporter, cashflow, anomali-deteksjon o.l.). Denne hooken brukes kun
 * der brukeren blar gjennom bilaglisten.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { orderBy, where, type QueryConstraint, type DocumentSnapshot } from "firebase/firestore";
import { getCollectionPaginated } from "@/lib/firebase/firestore";
import type { Bilag } from "@/types";

export type BilagMedId = Bilag & { id: string };

export const BILAG_PAGE_SIZE = 50;

export type BilagFilter = {
  klientId?: string;
  status?: Bilag["status"];
  søk?: string;
};

/**
 * Pagineringshook for bilaglisten.
 *
 * Returnerer `bilag` (side N), `hasMore` (om det finnes flere),
 * `loading`, `nesteSide()` og `tilbakestill()`.
 *
 * Søk på beskrivelse skjer klient-side siden Firestore ikke støtter full-text.
 */
export function usePaginertBilag(uid: string | null, filter?: BilagFilter) {
  const [bilag, setBilag] = useState<BilagMedId[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [side, setSide] = useState(1);

  // Cursor (siste dokument fra forrige side)
  const cursorRef = useRef<DocumentSnapshot | null>(null);
  // Alle hentede bilag (for lokal søk)
  const alleBilagRef = useRef<BilagMedId[]>([]);

  const path = uid ? `users/${uid}/bilag` : null;

  const hentSide = useCallback(
    async (reset = false) => {
      if (!path) return;
      setLoading(true);
      try {
        const constraints: QueryConstraint[] = [];
        if (filter?.klientId) {
          constraints.push(where("klientId", "==", filter.klientId));
        }
        if (filter?.status) {
          constraints.push(where("status", "==", filter.status));
        }
        constraints.push(orderBy("dato", "desc"));

        const { data, lastDoc, hasMore: mer } = await getCollectionPaginated<Bilag>(
          path,
          BILAG_PAGE_SIZE,
          reset ? null : cursorRef.current,
          ...constraints
        );

        const nyeBilag = data as BilagMedId[];

        if (reset) {
          alleBilagRef.current = nyeBilag;
          cursorRef.current = lastDoc;
          setSide(1);
        } else {
          alleBilagRef.current = [...alleBilagRef.current, ...nyeBilag];
          cursorRef.current = lastDoc;
          setSide((s) => s + 1);
        }

        setHasMore(mer);
        setBilag(alleBilagRef.current);
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [path, filter?.klientId, filter?.status]
  );

  // Nullstill og last inn på nytt når filter endres
  useEffect(() => {
    alleBilagRef.current = [];
    cursorRef.current = null;
    hentSide(true);
  }, [hentSide]);

  const nesteSide = useCallback(() => {
    if (!hasMore || loading) return;
    hentSide(false);
  }, [hasMore, loading, hentSide]);

  const tilbakestill = useCallback(() => {
    alleBilagRef.current = [];
    cursorRef.current = null;
    hentSide(true);
  }, [hentSide]);

  // Lokal fritekst-filtrering
  const filtrerteBilag =
    filter?.søk
      ? alleBilagRef.current.filter((b) => {
          const s = filter.søk!.toLowerCase();
          return (
            b.beskrivelse.toLowerCase().includes(s) ||
            b.leverandor?.toLowerCase().includes(s) ||
            b.bilagsnr.toString().includes(s)
          );
        })
      : bilag;

  return {
    bilag: filtrerteBilag,
    loading,
    hasMore,
    side,
    nesteSide,
    tilbakestill,
  };
}
