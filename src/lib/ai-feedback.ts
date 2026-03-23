/**
 * AI Feedback Loop — lær av brukerens godkjenninger og avvisninger
 *
 * Lagrer feedback-data i Firestore slik at AI-agenten kan forbedre
 * fremtidige forslag basert på faktisk brukeratferd.
 *
 * Datastruktur: users/{uid}/ai_feedback/{bilagId}
 *
 * Bruk:
 * - Kall `registrerGodkjenning()` når bruker godkjenner et AI-forslag
 * - Kall `registrerAvvisning()` når bruker avviser et AI-forslag
 * - Kall `registrerKorreksjon()` når bruker manuelt endrer posteringer
 */

import { doc, setDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/firestore";
import type { AiForslag } from "@/types";

export type AiFeedbackType =
  | "godkjent"          // Bruker godkjente forslaget uendret
  | "avvist"            // Bruker avviste forslaget
  | "korrigert"         // Bruker endret posteringene manuelt
  | "auto_bokfort";     // System auto-bokførte basert på terskel

export type AiFeedback = {
  bilagId: string;
  bilagsnr: number;
  type: AiFeedbackType;
  /** Originalt AI-forslag */
  forslag: {
    posteringer: AiForslag["posteringer"];
    begrunnelse: string;
    konfidens: number;
    foreslåttKategori: string;
  };
  /** Faktisk bokføring (kan avvike fra forslaget ved korreksjon) */
  faktiskePosteringer?: AiForslag["posteringer"];
  /** Leverandørnavn for mønstergjenkjenning */
  leverandor?: string;
  /** Bilagets beskrivelse */
  beskrivelse?: string;
  /** Beløp */
  belop?: number;
  tidspunkt?: unknown;
};

/**
 * Registrer at bruker godkjente et AI-forslag.
 * Brukes for å gi positiv forsterkningssignal til modellen.
 */
export async function registrerGodkjenning(
  uid: string,
  bilagId: string,
  bilagsnr: number,
  forslag: AiForslag,
  meta?: { leverandor?: string; beskrivelse?: string; belop?: number }
): Promise<void> {
  try {
    const feedback: AiFeedback = {
      bilagId,
      bilagsnr,
      type: "godkjent",
      forslag: {
        posteringer: forslag.posteringer,
        begrunnelse: forslag.begrunnelse,
        konfidens: forslag.konfidens,
        foreslåttKategori: forslag.foreslåttKategori,
      },
      ...meta,
      tidspunkt: serverTimestamp(),
    };
    // Lagre i brukerens feedback-collection
    await addDoc(collection(db, "users", uid, "ai_feedback"), feedback);
  } catch {
    // Feedback-feil er ikke kritiske — logg og fortsett
    console.warn("[ai-feedback] Klarte ikke lagre godkjennings-feedback");
  }
}

/**
 * Registrer at bruker avviste et AI-forslag.
 * Brukes for å gi negativt signal — lignende forslag bør sendes til review.
 */
export async function registrerAvvisning(
  uid: string,
  bilagId: string,
  bilagsnr: number,
  forslag: AiForslag,
  meta?: { leverandor?: string; beskrivelse?: string; belop?: number }
): Promise<void> {
  try {
    const feedback: AiFeedback = {
      bilagId,
      bilagsnr,
      type: "avvist",
      forslag: {
        posteringer: forslag.posteringer,
        begrunnelse: forslag.begrunnelse,
        konfidens: forslag.konfidens,
        foreslåttKategori: forslag.foreslåttKategori,
      },
      ...meta,
      tidspunkt: serverTimestamp(),
    };
    await addDoc(collection(db, "users", uid, "ai_feedback"), feedback);
  } catch {
    console.warn("[ai-feedback] Klarte ikke lagre avvisnings-feedback");
  }
}

/**
 * Registrer at bruker korrigerte posteringene manuelt.
 * Sender både originalt forslag og faktisk korreksjon — den viktigste
 * læringskilden for fine-tuning.
 */
export async function registrerKorreksjon(
  uid: string,
  bilagId: string,
  bilagsnr: number,
  forslag: AiForslag,
  faktiskePosteringer: AiForslag["posteringer"],
  meta?: { leverandor?: string; beskrivelse?: string; belop?: number }
): Promise<void> {
  try {
    const feedback: AiFeedback = {
      bilagId,
      bilagsnr,
      type: "korrigert",
      forslag: {
        posteringer: forslag.posteringer,
        begrunnelse: forslag.begrunnelse,
        konfidens: forslag.konfidens,
        foreslåttKategori: forslag.foreslåttKategori,
      },
      faktiskePosteringer,
      ...meta,
      tidspunkt: serverTimestamp(),
    };
    await addDoc(collection(db, "users", uid, "ai_feedback"), feedback);
  } catch {
    console.warn("[ai-feedback] Klarte ikke lagre korrigerings-feedback");
  }
}

/** Hent statistikk for feedback-visning i innstillinger */
export async function hentFeedbackStatistikk(uid: string): Promise<{
  totalt: number;
  godkjent: number;
  avvist: number;
  korrigert: number;
  godkjenningsRate: number;
}> {
  try {
    const { getDocs, collection: col, query, where } = await import("firebase/firestore");
    const snap = await getDocs(col(db, "users", uid, "ai_feedback"));
    const all = snap.docs.map((d) => d.data() as AiFeedback);
    const godkjent = all.filter((f) => f.type === "godkjent" || f.type === "auto_bokfort").length;
    const avvist = all.filter((f) => f.type === "avvist").length;
    const korrigert = all.filter((f) => f.type === "korrigert").length;
    const totalt = all.length;
    return {
      totalt,
      godkjent,
      avvist,
      korrigert,
      godkjenningsRate: totalt > 0 ? Math.round((godkjent / totalt) * 100) : 0,
    };
  } catch {
    return { totalt: 0, godkjent: 0, avvist: 0, korrigert: 0, godkjenningsRate: 0 };
  }
}
