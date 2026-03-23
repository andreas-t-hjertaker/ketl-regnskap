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

/** Tilgjengelige API-scopes */
export const API_SCOPES = [
  "bilag:read",
  "bilag:write",
  "klienter:read",
  "klienter:write",
  "rapporter:read",
  "saft:export",
  "ai:chat",
  "admin",
] as const;

export type ApiScope = typeof API_SCOPES[number];

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
  scopes: ApiScope[];     // Tilgangsnivåer for denne nøkkelen
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

/** Webhook-konfigurasjon */
export type WebhookHendelse =
  | "bilag.opprettet"
  | "bilag.oppdatert"
  | "bilag.bokfort"
  | "bilag.avvist"
  | "bilag.kreditert"
  | "klient.opprettet"
  | "klient.oppdatert";

export type WebhookKonfig = {
  url: string;
  hendelser: WebhookHendelse[];
  aktiv: boolean;
  opprettet: Date;
  userId: string;
  /** SHA-256 HMAC-signeringsnøkkel (lagres hashet i Firestore) */
  hashetSecret: string;
};

export type WebhookLogg = {
  webhookId: string;
  hendelse: WebhookHendelse;
  statusKode: number;
  forsøk: number;
  url: string;
  tidspunkt: Date;
  ok: boolean;
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
  /** ISO-dato for forfall — brukes til purring og inkasso-oppfølging */
  forfallsDato?: string;
  /** Purre-status: antall purringer sendt og siste purredato */
  purring?: {
    antall: number;          // Antall purringer sendt (1 = 1. purring, 2 = 2. purring osv.)
    sistePurringDato: string; // ISO-dato
    inkasso?: boolean;        // True hvis saken er sendt til inkasso
  };
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
  /** Detaljert forklaring av AI-valgene (#100 Agent-forklarbarhet) */
  forklaring?: AiForslagForklaring;
};

/** Strukturert forklaring av AI-beslutningen */
export type AiForslagForklaring = {
  /** Hva AI-en identifiserte i dokumentet */
  dokumentSignaler: string[];
  /** Hvorfor agenten valgte hver konto */
  kontoValg: {
    kontonr: string;
    grunn: string;
  }[];
  /** Regelreferanser (bokføringslov, MVA-lov osv.) */
  regelreferanser?: string[];
  /** Lignende historiske bilag som påvirket forslaget */
  lignendeBilag?: {
    bilagsnr: number;
    beskrivelse: string;
    likhet: number; // 0-1
  }[];
  /** Usikkerhetsområder — hva agenten var usikker på */
  usikkerhet?: string[];
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

/** Budsjettlinje per konto */
export type BudsjettLinje = {
  kontonr: string;
  kontonavn: string;
  /** Årsbudsjett i NOK */
  årsbudsjett: number;
  /** Månedlige budsjett, indeks 0=jan … 11=des. Tomt betyr jevn fordeling */
  måneder?: number[];
};

/** Årsbudsjett for en klient */
export type Budsjett = {
  år: number;
  klientId: string;
  linjer: BudsjettLinje[];
  opprettet: Date;
  oppdatert: Date;
};

/** Avskrivningsmetode */
export type Avskrivningsmetode = "lineær" | "saldo";

/** Anleggsmiddel i anleggsmiddelregisteret */
export type Anleggsmiddel = {
  klientId: string;
  navn: string;
  kontonr: string;       // Balansekontonr, f.eks. "1200" (maskiner)
  kostpris: number;      // Anskaffelseskost
  anskaffetDato: string; // ISO-dato
  /** Forventet levetid i år */
  levetidÅr: number;
  metode: Avskrivningsmetode;
  /** Restverdi ved lineær avskrivning */
  restverdi?: number;
  /** Avskrivningssats for saldobasert metode (0-100%) */
  saldoSats?: number;
  aktivert: boolean;
  opprettet: Date;
};

/** Beregnet avskrivningslinje for ett år */
export type Avskrivningslinje = {
  år: number;
  avskrivning: number;
  akkumulertAvskrivning: number;
  bokførtVerdi: number;
};

/** Aktivitetslogg for agenten */
export type AgentAktivitet = {
  type: "bokføring" | "forslag" | "rapport" | "epost" | "avstemming";
  beskrivelse: string;
  tidspunkt: Date;
  klientId?: string;
  bilagId?: string;
};
