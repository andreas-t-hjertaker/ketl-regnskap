// Delte typer for hele prosjektet

/** Standard API-respons fra Cloud Functions */
export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/** Brukertype som speiler Firebase Auth-felter */
export type User = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
};

/** Legg til id-felt på en type */
export type WithId<T> = T & { id: string };

/** Legg til tidsstempler */
export type WithTimestamps<T> = T & {
  createdAt: Date;
  updatedAt: Date;
};

/** Standard Firestore-dokument med id og tidsstempler */
export type FirestoreDoc = WithId<WithTimestamps<Record<string, unknown>>>;

/** Stripe abonnement-status */
export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | "paused";

/** Prisplan-definisjon */
export type PricingPlan = {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: "month" | "year";
  features: string[];
  stripePriceId: string;
  highlighted?: boolean;
};

/** Brukerens abonnement lagret i Firestore */
export type UserSubscription = {
  stripeCustomerId: string;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  status: SubscriptionStatus | "none";
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
};

/** API-nøkkel lagret i Firestore */
export type ApiKey = {
  id: string;
  name: string;
  prefix: string;         // Første 8 tegn, for visning: "sk_live_abc..."
  hashedKey: string;       // SHA-256 hash av full nøkkel
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revoked: boolean;
};

// ─── Regnskapsdomene ────────────────────────────────────────────────────────

/** Regnskapsklient (bedrift som bruker tjenesten) */
export type Klient = {
  navn: string;
  orgnr: string;
  kontaktperson: string;
  epost: string;
  telefon?: string;
  adresse?: string;
  bransje?: string;
  opprettet: Date;
};

/** Motpart — kunde eller leverandør (Bokfl. + SAF-T krav) */
export type Motpart = {
  /** "kunde" (debitorer) eller "leverandor" (kreditorer) */
  type: "kunde" | "leverandor";
  navn: string;
  orgnr?: string;           // 9 siffer, valgfritt for privatpersoner
  kontaktperson?: string;
  epost?: string;
  telefon?: string;
  adresse?: string;
  klientId: string;         // Hvilken regnskapsklient motparten tilhører
  opprettet: Date;
};

/** Kontoplan-konto (NS 4102 standard) */
export type Konto = {
  nummer: string;       // f.eks. "3000"
  navn: string;         // f.eks. "Salgsinntekt"
  type: "eiendel" | "gjeld" | "egenkapital" | "inntekt" | "kostnad";
  mvaKode?: string;
};

/** Bilag / Voucher */
export type Bilag = {
  bilagsnr: number;
  dato: string;         // ISO date
  beskrivelse: string;
  belop: number;        // beløp i NOK
  klientId: string;
  /** Bokfl. § 13: 5 år oppbevaringsplikt. "arkivert" settes av scheduled function etter utløp. */
  status: "ubehandlet" | "foreslått" | "bokført" | "avvist" | "kreditert" | "arkivert";
  kategori?: string;
  leverandor?: string;
  vedleggUrl?: string;  // Firebase Storage URL for kvittering/faktura
  posteringer: Postering[];
  aiForslag?: AiForslag;
  /** Motpart-ID (kunde eller leverandør) koblet til dette bilaget */
  motpartId?: string;
  /** ID til korrigeringsbilag som reverserer dette bilaget */
  kreditertAvId?: string;
  /** ID til originalbilag som dette bilaget reverserer */
  korrigererBilagId?: string;
  /** ISO-dato for når bilaget ble arkivert (etter 5 år iht. Bokfl. § 13) */
  arkivertDato?: string;
};

/** Postering (debet/kredit-linje i et bilag) */
export type Postering = {
  kontonr: string;
  kontonavn: string;
  debet: number;
  kredit: number;
  mvaKode?: string;
  beskrivelse?: string;
};

/** AI-assistent sitt forslag til bokføring */
export type AiForslag = {
  posteringer: Postering[];
  begrunnelse: string;
  konfidens: number;    // 0-1
  foreslåttKategori: string;
  tidspunkt: Date;
};

/** Månedlig oversikt */
export type MånedRapport = {
  periode: string;     // "2026-03"
  inntekter: number;
  kostnader: number;
  resultat: number;
  antallBilag: number;
  ubehandlede: number;
};

/** Aktivitetslogg for agenten */
export type AgentAktivitet = {
  type: "bokføring" | "forslag" | "rapport" | "epost" | "avstemming";
  beskrivelse: string;
  tidspunkt: Date;
  klientId?: string;
  bilagId?: string;
};
