"use client";

/**
 * Hook for regnskapsperioder (#116).
 *
 * En periode er én kalendermåned med status: åpen | låst | lukket.
 * - Åpen:  bokføring tillatt (standard)
 * - Låst:  ingen nye bilag kan bokføres; kan gjenåpnes av bruker
 * - Lukket: endelig avsluttet; kan ikke gjenåpnes
 *
 * Perioder lagres i `users/{uid}/regnskapsperioder` med document-ID
 * `{klientId ?? "global"}-{YYYY-MM}`.
 */

import { useState, useEffect, useCallback } from "react";
import {
  doc,
  setDoc,
  serverTimestamp,
  where,
  orderBy,
} from "firebase/firestore";
import { db, subscribeToCollection } from "@/lib/firebase/firestore";
import { loggHandling } from "@/lib/audit";
import { showToast } from "@/lib/toast";
import type { Regnskapsperiode, PeriodeStatus } from "@/types";

export type RegnskapsperiodeMedId = Regnskapsperiode & { id: string };

/** Formaterer periodeID: `{klientId}-{YYYY-MM}` */
function periodeId(klientId: string, år: number, måned: number): string {
  return `${klientId}-${år}-${String(måned).padStart(2, "0")}`;
}

/** Returnerer `YYYY-MM`-streng for år+måned */
export function periodeNøkkel(år: number, måned: number): string {
  return `${år}-${String(måned).padStart(2, "0")}`;
}

export function useRegnskapsperioder(uid: string | null, klientId?: string | null) {
  const [perioder, setPerioder] = useState<RegnskapsperiodeMedId[]>([]);
  const [loading, setLoading] = useState(true);

  const path = uid ? `users/${uid}/regnskapsperioder` : null;
  const klientNøkkel = klientId ?? "global";

  useEffect(() => {
    if (!path) {
      setPerioder([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToCollection<Regnskapsperiode>(
      path,
      (data) => {
        setPerioder(data as RegnskapsperiodeMedId[]);
        setLoading(false);
      },
      where("klientId", "==", klientNøkkel),
      orderBy("år", "desc"),
      orderBy("måned", "desc")
    );

    return unsubscribe;
  }, [path, klientNøkkel]);

  /** Finn status for en gitt måned (default: åpen) */
  const hentStatus = useCallback(
    (år: number, måned: number): PeriodeStatus => {
      const id = periodeId(klientNøkkel, år, måned);
      const p = perioder.find((x) => x.id === id);
      return p?.status ?? "åpen";
    },
    [perioder, klientNøkkel]
  );

  /** Er perioden låst eller lukket? */
  const erLåst = useCallback(
    (år: number, måned: number): boolean => {
      const s = hentStatus(år, måned);
      return s === "låst" || s === "lukket";
    },
    [hentStatus]
  );

  /** Sett periode-status — intern hjelper */
  const settStatus = useCallback(
    async (år: number, måned: number, status: PeriodeStatus, merknad?: string) => {
      if (!uid || !path) return;
      const id = periodeId(klientNøkkel, år, måned);
      const dokRef = doc(db, path, id);

      const existing = perioder.find((x) => x.id === id);

      // Kan ikke gjenåpne en lukket periode
      if (existing?.status === "lukket" && status !== "lukket") {
        showToast.error("En lukket periode kan ikke gjenåpnes.");
        return;
      }

      try {
        await setDoc(
          dokRef,
          {
            klientId: klientNøkkel,
            år,
            måned,
            status,
            merknad: merknad ?? existing?.merknad ?? null,
            lukketAv: status !== "åpen" ? uid : null,
            lukketTidspunkt: status !== "åpen" ? new Date().toISOString() : null,
            opprettet: existing ? existing.opprettet : serverTimestamp(),
          },
          { merge: true }
        );

        const handling =
          status === "låst"
            ? "periode_låst"
            : status === "lukket"
            ? "periode_lukket"
            : "periode_åpnet";

        await loggHandling(uid, handling, "periode", id, {
          år,
          måned,
          status,
          klientId: klientNøkkel,
        });

        const label =
          status === "låst" ? "låst" : status === "lukket" ? "lukket" : "gjenåpnet";
        showToast.success(
          `Periode ${år}-${String(måned).padStart(2, "0")} ${label}.`
        );
      } catch {
        showToast.error("Klarte ikke oppdatere periodens status.");
      }
    },
    [uid, path, klientNøkkel, perioder]
  );

  const låsPeriode = useCallback(
    (år: number, måned: number, merknad?: string) =>
      settStatus(år, måned, "låst", merknad),
    [settStatus]
  );

  const lukkPeriode = useCallback(
    (år: number, måned: number, merknad?: string) =>
      settStatus(år, måned, "lukket", merknad),
    [settStatus]
  );

  const åpnePeriode = useCallback(
    (år: number, måned: number) => settStatus(år, måned, "åpen"),
    [settStatus]
  );

  return {
    perioder,
    loading,
    hentStatus,
    erLåst,
    låsPeriode,
    lukkPeriode,
    åpnePeriode,
  };
}
