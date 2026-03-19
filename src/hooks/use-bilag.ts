"use client";

import { useState, useEffect, useCallback } from "react";
import { orderBy, where } from "firebase/firestore";
import {
  subscribeToCollection,
  addDocument,
  updateDocument,
  deleteDocument,
  nestebilagsnummer,
} from "@/lib/firebase/firestore";
import { loggHandling } from "@/lib/audit";
import { showToast } from "@/lib/toast";
import type { Bilag } from "@/types";

export type BilagMedId = Bilag & { id: string };


export function useBilag(uid: string | null, klientId?: string | null) {
  const [bilag, setBilag] = useState<BilagMedId[]>([]);
  const [loading, setLoading] = useState(true);

  const path = uid ? `users/${uid}/bilag` : null;

  useEffect(() => {
    if (!path) {
      setBilag([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const constraints = klientId
      ? [where("klientId", "==", klientId), orderBy("dato", "desc")]
      : [orderBy("dato", "desc")];

    const unsubscribe = subscribeToCollection<Bilag>(
      path,
      (data) => {
        setBilag(data as BilagMedId[]);
        setLoading(false);
      },
      ...constraints
    );

    return unsubscribe;
  }, [path, klientId]);

  const addBilag = useCallback(
    async (data: Omit<Bilag, "bilagsnr">): Promise<string | null> => {
      if (!uid || !path) return null;
      try {
        const år = data.dato ? parseInt(data.dato.slice(0, 4), 10) : undefined;
        const bilagsnr = await nestebilagsnummer(uid, år);
        const ref = await addDocument(path, { ...data, bilagsnr });
        await loggHandling(uid, "bilag_opprettet", "bilag", ref.id, {
          bilagsnr,
          beskrivelse: data.beskrivelse,
          belop: data.belop,
        });
        showToast.success(`Bilag #${bilagsnr} opprettet.`);
        return ref.id;
      } catch {
        showToast.error("Klarte ikke opprette bilag.");
        return null;
      }
    },
    [uid, path]
  );

  const updateBilag = useCallback(
    async (id: string, data: Partial<Bilag>): Promise<void> => {
      if (!uid || !path) return;
      try {
        await updateDocument(path, id, data);
        await loggHandling(uid, "bilag_oppdatert", "bilag", id, data as Record<string, unknown>);
      } catch {
        showToast.error("Klarte ikke oppdatere bilag.");
      }
    },
    [uid, path]
  );

  const deleteBilag = useCallback(
    async (id: string): Promise<void> => {
      if (!uid || !path) return;
      try {
        await deleteDocument(path, id);
        await loggHandling(uid, "bilag_slettet", "bilag", id);
        showToast.success("Bilag slettet.");
      } catch {
        showToast.error("Klarte ikke slette bilag.");
      }
    },
    [uid, path]
  );

  const godkjennBilag = useCallback(
    async (id: string): Promise<void> => {
      if (!uid || !path) return;
      const b = bilag.find((x) => x.id === id);
      if (!b?.aiForslag) return;
      try {
        await updateDocument(path, id, {
          status: "bokført",
          posteringer: b.aiForslag.posteringer,
          kategori: b.aiForslag.foreslåttKategori,
        });
        await loggHandling(uid, "ai_forslag_godkjent", "bilag", id, {
          konfidens: b.aiForslag.konfidens,
        });
        showToast.success("Bilag bokført.");
      } catch {
        showToast.error("Klarte ikke bokføre bilag.");
      }
    },
    [uid, path, bilag]
  );

  const avvisBilag = useCallback(
    async (id: string): Promise<void> => {
      if (!uid || !path) return;
      try {
        await updateDocument(path, id, { status: "avvist" });
        await loggHandling(uid, "bilag_avvist", "bilag", id);
        showToast.success("AI-forslag avvist.");
      } catch {
        showToast.error("Klarte ikke avvise bilag.");
      }
    },
    [uid, path]
  );

  const getBilagByStatus = useCallback(
    (status: Bilag["status"]): BilagMedId[] => {
      return bilag.filter((b) => b.status === status);
    },
    [bilag]
  );

  return {
    bilag,
    loading,
    addBilag,
    updateBilag,
    deleteBilag,
    godkjennBilag,
    avvisBilag,
    getBilagByStatus,
  };
}
