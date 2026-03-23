"use client";

/**
 * Prosjektregnskap-hook (#40)
 *
 * CRUD for prosjekter og beregning av prosjektresultat basert på
 * bilag koblet via prosjektId.
 *
 * Lagring: users/{uid}/prosjekter/{prosjektId}
 */

import { useState, useEffect, useCallback } from "react";
import { orderBy, where, serverTimestamp } from "firebase/firestore";
import {
  subscribeToCollection,
  addDocument,
  updateDocument,
  deleteDocument,
} from "@/lib/firebase/firestore";
import { loggHandling } from "@/lib/audit";
import { showToast } from "@/lib/toast";
import type { Prosjekt } from "@/types";
import type { BilagMedId } from "@/hooks/use-bilag";

export type ProsjektMedId = Prosjekt & { id: string };

export type ProsjektResultat = {
  prosjekt: ProsjektMedId;
  inntekter: number;
  kostnader: number;
  resultat: number;
  antallBilag: number;
  forbrukPst: number;   // prosent av budsjett brukt
};

export function useProsjekter(uid: string | null, klientId?: string | null) {
  const [prosjekter, setProsjekter] = useState<ProsjektMedId[]>([]);
  const [loading, setLoading] = useState(true);

  const path = uid ? `users/${uid}/prosjekter` : null;

  useEffect(() => {
    if (!path) {
      setProsjekter([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const constraints = klientId
      ? [where("klientId", "==", klientId), orderBy("opprettet", "desc")]
      : [orderBy("opprettet", "desc")];

    const unsub = subscribeToCollection<Prosjekt>(
      path,
      (data) => {
        setProsjekter(data as ProsjektMedId[]);
        setLoading(false);
      },
      ...constraints
    );
    return unsub;
  }, [path, klientId]);

  const addProsjekt = useCallback(
    async (data: Omit<Prosjekt, "opprettet">): Promise<string | null> => {
      if (!uid || !path) return null;
      try {
        const ref = await addDocument(path, { ...data, opprettet: serverTimestamp() });
        await loggHandling(uid, "prosjekt_opprettet", "prosjekt", ref.id, { navn: data.navn });
        showToast.success(`Prosjekt «${data.navn}» opprettet.`);
        return ref.id;
      } catch {
        showToast.error("Klarte ikke opprette prosjekt.");
        return null;
      }
    },
    [uid, path]
  );

  const updateProsjekt = useCallback(
    async (id: string, data: Partial<Prosjekt>): Promise<void> => {
      if (!uid || !path) return;
      try {
        await updateDocument(path, id, data);
        await loggHandling(uid, "prosjekt_oppdatert", "prosjekt", id, data as Record<string, unknown>);
        showToast.success("Prosjekt oppdatert.");
      } catch {
        showToast.error("Klarte ikke oppdatere prosjekt.");
      }
    },
    [uid, path]
  );

  const deleteProsjekt = useCallback(
    async (id: string): Promise<void> => {
      if (!uid || !path) return;
      try {
        await deleteDocument(path, id);
        await loggHandling(uid, "prosjekt_slettet", "prosjekt", id);
        showToast.success("Prosjekt slettet.");
      } catch {
        showToast.error("Klarte ikke slette prosjekt.");
      }
    },
    [uid, path]
  );

  return { prosjekter, loading, addProsjekt, updateProsjekt, deleteProsjekt };
}

/** Beregn inntekter og kostnader for hvert prosjekt basert på bilag */
export function beregnProsjektResultater(
  prosjekter: ProsjektMedId[],
  bilag: BilagMedId[]
): ProsjektResultat[] {
  const bokforte = bilag.filter(
    (b) => b.status === "bokført" || b.status === "kreditert"
  );

  return prosjekter.map((p) => {
    const pBilag = bokforte.filter((b) => b.prosjektId === p.id);
    let inntekter = 0;
    let kostnader = 0;

    for (const b of pBilag) {
      for (const post of b.posteringer) {
        const klasse = post.kontonr[0];
        if (klasse === "3") inntekter += (post.kredit ?? 0) - (post.debet ?? 0);
        if (klasse >= "4" && klasse <= "8") kostnader += (post.debet ?? 0) - (post.kredit ?? 0);
      }
    }

    const forbrukPst =
      p.budsjett && p.budsjett > 0
        ? Math.min(Math.round((kostnader / p.budsjett) * 100), 999)
        : 0;

    return {
      prosjekt: p,
      inntekter: Math.abs(inntekter),
      kostnader: Math.abs(kostnader),
      resultat: Math.abs(inntekter) - Math.abs(kostnader),
      antallBilag: pBilag.length,
      forbrukPst,
    };
  });
}
