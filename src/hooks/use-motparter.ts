"use client";

import { useState, useEffect, useCallback } from "react";
import { orderBy, where } from "firebase/firestore";
import {
  subscribeToCollection,
  addDocument,
  updateDocument,
  deleteDocument,
} from "@/lib/firebase/firestore";
import { loggHandling } from "@/lib/audit";
import { showToast } from "@/lib/toast";
import type { Motpart } from "@/types";

export type MotpartMedId = Motpart & { id: string };

export function useMotparter(uid: string | null, klientId?: string | null) {
  const [motparter, setMotparter] = useState<MotpartMedId[]>([]);
  const [loading, setLoading] = useState(true);

  const path = uid ? `users/${uid}/motparter` : null;

  useEffect(() => {
    if (!path) {
      setMotparter([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const constraints = klientId
      ? [where("klientId", "==", klientId), orderBy("navn", "asc")]
      : [orderBy("navn", "asc")];

    const unsubscribe = subscribeToCollection<Motpart>(
      path,
      (data) => {
        setMotparter(data as MotpartMedId[]);
        setLoading(false);
      },
      ...constraints
    );

    return unsubscribe;
  }, [path, klientId]);

  const addMotpart = useCallback(
    async (data: Omit<Motpart, "opprettet">): Promise<string | null> => {
      if (!uid || !path) return null;
      try {
        const ref = await addDocument(path, {
          ...data,
          opprettet: new Date(),
        });
        await loggHandling(uid, "motpart_opprettet", "motpart", ref.id, {
          navn: data.navn,
          type: data.type,
        });
        showToast.success(`${data.type === "kunde" ? "Kunde" : "Leverandør"} lagt til.`);
        return ref.id;
      } catch {
        showToast.error("Klarte ikke legge til motpart.");
        return null;
      }
    },
    [uid, path]
  );

  const updateMotpart = useCallback(
    async (id: string, data: Partial<Motpart>): Promise<void> => {
      if (!uid || !path) return;
      try {
        await updateDocument(path, id, data);
        await loggHandling(uid, "motpart_oppdatert", "motpart", id, data as Record<string, unknown>);
      } catch {
        showToast.error("Klarte ikke oppdatere motpart.");
      }
    },
    [uid, path]
  );

  const deleteMotpart = useCallback(
    async (id: string): Promise<void> => {
      if (!uid || !path) return;
      try {
        await deleteDocument(path, id);
        await loggHandling(uid, "motpart_slettet", "motpart", id);
        showToast.success("Motpart slettet.");
      } catch {
        showToast.error("Klarte ikke slette motpart.");
      }
    },
    [uid, path]
  );

  const kunder = motparter.filter((m) => m.type === "kunde");
  const leverandorer = motparter.filter((m) => m.type === "leverandor");

  return {
    motparter,
    kunder,
    leverandorer,
    loading,
    addMotpart,
    updateMotpart,
    deleteMotpart,
  };
}
