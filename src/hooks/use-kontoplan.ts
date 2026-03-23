"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db, subscribeToCollection } from "@/lib/firebase/firestore";
import { NS4102_KONTOPLAN, type KontoMedGruppe } from "@/lib/kontoplan";
import { showToast } from "@/lib/toast";

type KontoOverride = {
  id: string;           // = kontonummer (document ID i Firestore)
  aktiv?: boolean;
  navn?: string;        // egendefinert navn
  gruppe?: string;
  type?: KontoMedGruppe["type"];
  isCustom?: boolean;
};

export type KontoMedStatus = KontoMedGruppe & {
  erDeaktivert: boolean;
  erCustom: boolean;
};

export function useKontoplan(uid: string | null) {
  const [overrides, setOverrides] = useState<KontoOverride[]>([]);
  const [loading, setLoading] = useState(true);

  const path = uid ? `users/${uid}/kontoplan` : null;

  useEffect(() => {
    if (!path) {
      setOverrides([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToCollection<KontoOverride>(
      path,
      (data) => {
        setOverrides(data);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [path]);

  const kontoplan = useMemo((): KontoMedStatus[] => {
    const overrideMap = new Map(overrides.map((o) => [o.id, o]));

    // Standard NS 4102 kontoer med eventuelle brukeroverrides
    const standard: KontoMedStatus[] = NS4102_KONTOPLAN.map((k) => {
      const override = overrideMap.get(k.nummer);
      return {
        ...k,
        navn: override?.navn ?? k.navn,
        erDeaktivert: override?.aktiv === false,
        erCustom: false,
      };
    });

    // Egendefinerte kontoer fra Firestore
    const custom: KontoMedStatus[] = overrides
      .filter((o) => o.isCustom === true)
      .map((o) => ({
        nummer: o.id,
        navn: o.navn ?? o.id,
        type: o.type ?? ("kostnad" as const),
        gruppe: o.gruppe ?? "Egendefinerte kontoer",
        aktiv: o.aktiv !== false,
        erDeaktivert: o.aktiv === false,
        erCustom: true,
        mvaKode: undefined,
      }));

    return [...standard, ...custom];
  }, [overrides]);

  /**
   * Slå på/av en konto.
   * For standard NS 4102-kontoer: lagrer en override med aktiv=false.
   * For egendefinerte kontoer: oppdaterer aktiv-feltet.
   */
  const toggleAktiv = useCallback(
    async (nummer: string): Promise<void> => {
      if (!uid || !path) return;
      const overrideMap = new Map(overrides.map((o) => [o.id, o]));
      const existing = overrideMap.get(nummer);
      const erDeaktivert = existing?.aktiv === false;

      try {
        await setDoc(
          doc(db, path, nummer),
          { aktiv: erDeaktivert },
          { merge: true }
        );
        showToast.success(erDeaktivert ? "Konto aktivert." : "Konto deaktivert.");
      } catch {
        showToast.error("Klarte ikke oppdatere konto.");
      }
    },
    [uid, path, overrides]
  );

  /**
   * Legg til en egendefinert konto som ikke er i NS 4102.
   */
  const addCustomKonto = useCallback(
    async (data: {
      nummer: string;
      navn: string;
      gruppe: string;
      type: KontoMedGruppe["type"];
    }): Promise<boolean> => {
      if (!uid || !path) return false;

      const isStandard = NS4102_KONTOPLAN.some((k) => k.nummer === data.nummer);
      if (isStandard) {
        showToast.error("Kontonummeret finnes allerede i NS 4102-kontoplanen.");
        return false;
      }
      const alreadyCustom = overrides.some(
        (o) => o.id === data.nummer && o.isCustom
      );
      if (alreadyCustom) {
        showToast.error("En egendefinert konto med dette nummeret finnes allerede.");
        return false;
      }

      try {
        await setDoc(doc(db, path, data.nummer), {
          navn: data.navn,
          gruppe: data.gruppe,
          type: data.type,
          aktiv: true,
          isCustom: true,
          opprettet: serverTimestamp(),
        });
        showToast.success(`Konto ${data.nummer} — ${data.navn} lagt til.`);
        return true;
      } catch {
        showToast.error("Klarte ikke legge til konto.");
        return false;
      }
    },
    [uid, path, overrides]
  );

  /**
   * Slett en egendefinert konto (kun kontoer lagt til av bruker).
   */
  const deleteCustomKonto = useCallback(
    async (nummer: string): Promise<void> => {
      if (!uid || !path) return;
      const override = overrides.find((o) => o.id === nummer && o.isCustom);
      if (!override) return;

      try {
        await deleteDoc(doc(db, path, nummer));
        showToast.success("Egendefinert konto slettet.");
      } catch {
        showToast.error("Klarte ikke slette konto.");
      }
    },
    [uid, path, overrides]
  );

  return {
    kontoplan,
    loading,
    toggleAktiv,
    addCustomKonto,
    deleteCustomKonto,
  };
}
