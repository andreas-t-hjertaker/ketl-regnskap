// Revisjonslogg — logger alle bruker- og systemhandlinger til Firestore
// Krav: Regnskapsloven §§ 8-5 og 10-1 (etterprøvbarhet)

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/firestore";

export type AuditHandling =
  | "bilag_opprettet"
  | "bilag_oppdatert"
  | "bilag_slettet"
  | "bilag_bokfort"
  | "bilag_avvist"
  | "ai_forslag_generert"
  | "ai_forslag_godkjent"
  | "ai_forslag_avvist"
  | "klient_opprettet"
  | "klient_oppdatert"
  | "klient_slettet"
  | "bilag_kreditert"
  | "fil_lastet_opp"
  | "fil_slettet";

export type AuditEntry = {
  handling: AuditHandling;
  entitetType: "bilag" | "klient" | "fil";
  entitetId: string;
  utfortAv: "bruker" | "ai";
  uid: string;
  detaljer?: Record<string, unknown>;
  tidspunkt: Date;
};

/**
 * Skriv en revisjonslogg-post til Firestore.
 * Denne funksjonen feiler lydløst — den skal ikke blokkere CRUD-operasjoner.
 */
export async function loggHandling(
  uid: string,
  handling: AuditHandling,
  entitetType: AuditEntry["entitetType"],
  entitetId: string,
  detaljer?: Record<string, unknown>,
  utfortAv: AuditEntry["utfortAv"] = "bruker"
): Promise<void> {
  try {
    await addDoc(collection(db, `users/${uid}/audit_log`), {
      handling,
      entitetType,
      entitetId,
      utfortAv,
      uid,
      detaljer: detaljer ?? {},
      tidspunkt: serverTimestamp(),
    });
  } catch {
    // Logg feilen uten å kaste videre — audit skal ikke bryte normal flyt
    console.warn("[audit] Klarte ikke skrive revisjonslogg:", handling, entitetId);
  }
}
