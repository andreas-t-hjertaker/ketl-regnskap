"use client";

import { useState, useEffect } from "react";
import { orderBy, limit } from "firebase/firestore";
import { subscribeToCollection } from "@/lib/firebase/firestore";
import type { AuditHandling } from "@/lib/audit";

export type AuditLogEntry = {
  id: string;
  handling: AuditHandling;
  entitetType: "bilag" | "klient" | "fil";
  entitetId: string;
  utfortAv: "bruker" | "ai" | "system";
  uid: string;
  detaljer?: Record<string, unknown>;
  tidspunkt: { seconds: number; nanoseconds: number } | Date | null;
};

export function useAuditLog(uid: string | null, maks = 100) {
  const [logg, setLogg] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setLogg([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToCollection<AuditLogEntry>(
      `users/${uid}/audit_log`,
      (data) => {
        setLogg(data as AuditLogEntry[]);
        setLoading(false);
      },
      orderBy("tidspunkt", "desc"),
      limit(maks)
    );

    return unsubscribe;
  }, [uid, maks]);

  return { logg, loading };
}
