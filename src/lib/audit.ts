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
  | "motpart_opprettet"
  | "motpart_oppdatert"
  | "motpart_slettet"
  | "bilag_kreditert"
  | "bilag_arkivert"
  | "fil_lastet_opp"
  | "fil_slettet"
  | "prosjekt_opprettet"
  | "prosjekt_oppdatert"
  | "prosjekt_slettet"
  | "ai_auto_bokfort"
  | "ansatt_opprettet"
  | "ansatt_oppdatert"
  | "ansatt_deaktivert"
  | "lonnsutbetaling_registrert"
  | "amelding_sendt"
  | "periode_låst"
  | "periode_lukket"
  | "periode_åpnet";

export type AuditEntry = {
  handling: AuditHandling;
  entitetType: "bilag" | "klient" | "motpart" | "fil" | "prosjekt" | "ansatt" | "lonnsutbetaling" | "amelding" | "periode";
  entitetId: string;
  utfortAv: "bruker" | "ai" | "system";
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
  utfortAv: "bruker" | "ai" | "system" = "bruker"
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
