"use client";

import { useState, useEffect, useCallback } from "react";
import { orderBy, where, serverTimestamp } from "firebase/firestore";
import {
  subscribeToCollection,
  addDocument,
  updateDocument,
  deleteDocument,
  getCollection,
} from "@/lib/firebase/firestore";
import { loggHandling } from "@/lib/audit";
import { showToast } from "@/lib/toast";
import { validerOrgnr, validerKontonr } from "@/lib/validering";
import type { Klient } from "@/types";

export type KlientMedId = Klient & { id: string };

export function useKlienter(uid: string | null) {
  const [klienter, setKlienter] = useState<KlientMedId[]>([]);
  const [loading, setLoading] = useState(true);

  const path = uid ? `users/${uid}/klienter` : null;

  useEffect(() => {
    if (!path) {
      setKlienter([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToCollection<Klient>(
      path,
      (data) => {
        setKlienter(data as KlientMedId[]);
        setLoading(false);
      },
      orderBy("opprettet", "desc")
    );

    return unsubscribe;
  }, [path]);

  const addKlient = useCallback(
    async (data: Omit<Klient, "opprettet">): Promise<string | null> => {
      if (!uid || !path) return null;

      const orgnrRaw = data.orgnr.replace(/[\s.]/g, "");
      if (!validerOrgnr(orgnrRaw)) {
        showToast.error("Ugyldig organisasjonsnummer. Sjekk at det er 9 sifre og passerer Modulus 11.");
        return null;
      }

      const kontonrRaw = data.bankkontonr?.replace(/[\s.]/g, "");
      if (kontonrRaw && !validerKontonr(kontonrRaw)) {
        showToast.error("Ugyldig bankkontonummer. Sjekk at det er 11 sifre og passerer Modulus 11.");
        return null;
      }

      try {
        const ref = await addDocument(path, {
          ...data,
          orgnr: orgnrRaw,
          ...(kontonrRaw ? { bankkontonr: kontonrRaw } : {}),
          opprettet: serverTimestamp(),
        });
        await loggHandling(uid, "klient_opprettet", "klient", ref.id, { navn: data.navn });
        showToast.success(`${data.navn} er lagt til.`);
        return ref.id;
      } catch {
        showToast.error("Klarte ikke legge til klient. Prøv igjen.");
        return null;
      }
    },
    [uid, path]
  );

  const updateKlient = useCallback(
    async (id: string, data: Partial<Klient>): Promise<void> => {
      if (!uid || !path) return;
      try {
        await updateDocument(path, id, data);
        await loggHandling(uid, "klient_oppdatert", "klient", id, data as Record<string, unknown>);
        showToast.success("Klient oppdatert.");
      } catch {
        showToast.error("Klarte ikke oppdatere klient.");
      }
    },
    [uid, path]
  );

  const deleteKlient = useCallback(
    async (id: string): Promise<void> => {
      if (!uid || !path) return;

      // Sjekk om klienten har bilag eller motparter
      try {
        const bilag = await getCollection(`users/${uid}/bilag`, where("klientId", "==", id));
        if (bilag.length > 0) {
          showToast.error("Kan ikke slette klient med tilknyttede bilag. Slett bilagene først.");
          return;
        }
        const motparter = await getCollection(`users/${uid}/motparter`, where("klientId", "==", id));
        if (motparter.length > 0) {
          showToast.error("Kan ikke slette klient med tilknyttede motparter. Slett motpartene først.");
          return;
        }
      } catch {
        showToast.error("Klarte ikke verifisere om klienten kan slettes.");
        return;
      }

      try {
        await deleteDocument(path, id);
        await loggHandling(uid, "klient_slettet", "klient", id);
        showToast.success("Klient slettet.");
      } catch {
        showToast.error("Klarte ikke slette klient.");
      }
    },
    [uid, path]
  );

  const getKlient = useCallback(
    (id: string): KlientMedId | undefined => {
      return klienter.find((k) => k.id === id);
    },
    [klienter]
  );

  return { klienter, loading, addKlient, updateKlient, deleteKlient, getKlient };
}
