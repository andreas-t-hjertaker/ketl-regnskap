"use client";

import { useState, useEffect, useCallback } from "react";
import { orderBy, where, type QueryConstraint } from "firebase/firestore";
import { subscribeToCollection, addDocument, updateDocument } from "@/lib/firebase/firestore";
import { loggHandling } from "@/lib/audit";
import { showToast } from "@/lib/toast";
import { fetchApi } from "@/lib/api-client";
import type { Ansatt, LonnsUtbetaling, AmeldinInnsending } from "@/types";

export type AnsattMedId = Ansatt & { id: string };
export type LonnsUtbetalingMedId = LonnsUtbetaling & { id: string };
export type AmeldinInnsendingMedId = AmeldinInnsending & { id: string };

// ─── Hook for ansatte ─────────────────────────────────────────────────────────

export function useAnsatte(uid: string | null, klientId?: string | null) {
  const [ansatte, setAnsatte] = useState<AnsattMedId[]>([]);
  const [loading, setLoading] = useState(true);

  const path = uid ? `users/${uid}/ansatte` : null;

  useEffect(() => {
    if (!path) {
      setAnsatte([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const constraints: QueryConstraint[] = [];
    if (klientId) constraints.push(where("klientId", "==", klientId));
    constraints.push(orderBy("navn"));

    const unsubscribe = subscribeToCollection<Ansatt>(
      path,
      (data) => {
        setAnsatte(data as AnsattMedId[]);
        setLoading(false);
      },
      ...constraints
    );
    return unsubscribe;
  }, [path, klientId]);

  const opprettAnsatt = useCallback(
    async (data: Omit<Ansatt, "opprettet" | "aktiv">) => {
      if (!uid || !path) return;
      await addDocument(path, {
        ...data,
        aktiv: true,
        opprettet: new Date(),
      });
      await loggHandling(uid, "ansatt_opprettet", "ansatt", data.fnr);
      showToast.success(`${data.navn} er registrert som ansatt.`);
    },
    [uid, path]
  );

  const deaktiverAnsatt = useCallback(
    async (id: string, navn: string) => {
      if (!uid || !path) return;
      await updateDocument(path, id, {
        aktiv: false,
        sluttdato: new Date().toISOString().slice(0, 10),
      });
      await loggHandling(uid, "ansatt_deaktivert", "ansatt", id);
      showToast.success(`${navn} er markert som avsluttet.`);
    },
    [uid, path]
  );

  return { ansatte, loading, opprettAnsatt, deaktiverAnsatt };
}

// ─── Hook for lønnsutbetalinger ───────────────────────────────────────────────

export function useLonnsUtbetalinger(
  uid: string | null,
  klientId?: string | null,
  kalendermaaned?: string | null
) {
  const [utbetalinger, setUtbetalinger] = useState<LonnsUtbetalingMedId[]>([]);
  const [loading, setLoading] = useState(true);

  const path = uid ? `users/${uid}/lonnsutbetalinger` : null;

  useEffect(() => {
    if (!path) {
      setUtbetalinger([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const constraints: QueryConstraint[] = [];
    if (klientId) constraints.push(where("klientId", "==", klientId));
    if (kalendermaaned) constraints.push(where("kalendermaaned", "==", kalendermaaned));
    constraints.push(orderBy("utbetaltDato", "desc"));

    const unsubscribe = subscribeToCollection<LonnsUtbetaling>(
      path,
      (data) => {
        setUtbetalinger(data as LonnsUtbetalingMedId[]);
        setLoading(false);
      },
      ...constraints
    );
    return unsubscribe;
  }, [path, klientId, kalendermaaned]);

  const registrerUtbetaling = useCallback(
    async (data: Omit<LonnsUtbetaling, "opprettet" | "status" | "arbeidsgiveravgift">) => {
      if (!uid || !path) return;
      const arbeidsgiveravgift = Math.round(data.bruttoLonn * 0.141 * 100) / 100;
      await addDocument(path, {
        ...data,
        arbeidsgiveravgift,
        status: "kladd",
        opprettet: new Date(),
      });
      await loggHandling(uid, "lonnsutbetaling_registrert", "lonnsutbetaling", data.ansattId);
      showToast.success("Lønnsutbetaling registrert.");
    },
    [uid, path]
  );

  return { utbetalinger, loading, registrerUtbetaling };
}

// ─── Hook for A-melding-innsendinger ─────────────────────────────────────────

export function useAmeldinInnsendinger(uid: string | null, klientId?: string | null) {
  const [innsendinger, setInnsendinger] = useState<AmeldinInnsendingMedId[]>([]);
  const [loading, setLoading] = useState(true);
  const [sender, setSender] = useState(false);

  const path = uid ? `users/${uid}/amelding_innsendinger` : null;

  useEffect(() => {
    if (!path) {
      setInnsendinger([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const constraints: QueryConstraint[] = [];
    if (klientId) constraints.push(where("klientId", "==", klientId));
    constraints.push(orderBy("sendtTidspunkt", "desc"));

    const unsubscribe = subscribeToCollection<AmeldinInnsending>(
      path,
      (data) => {
        setInnsendinger(data as AmeldinInnsendingMedId[]);
        setLoading(false);
      },
      ...constraints
    );
    return unsubscribe;
  }, [path, klientId]);

  const sendAmelding = useCallback(
    async (klientId: string, kalendermaaned: string, orgnr: string): Promise<boolean> => {
      if (!uid) return false;
      setSender(true);
      try {
        const resp = await fetchApi<{
          innsendingId: string;
          meldingsId: string;
          referansenummer: string | null;
          kalendermaaned: string;
          antallArbeidsforhold: number;
          status: string;
        }>("/v1/amelding/send", {
          method: "POST",
          body: { klientId, kalendermaaned, orgnr },
        });

        if (resp.success) {
          showToast.success(
            `A-melding for ${kalendermaaned} sendt. Referanse: ${resp.data.referansenummer ?? resp.data.meldingsId}`
          );
          await loggHandling(uid, "amelding_sendt", "amelding", resp.data.innsendingId);
          return true;
        } else {
          showToast.error(`Innsending feilet: ${resp.error}`);
          return false;
        }
      } finally {
        setSender(false);
      }
    },
    [uid]
  );

  return { innsendinger, loading, sender, sendAmelding };
}
