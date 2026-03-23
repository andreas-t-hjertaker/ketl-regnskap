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
  /** Bankkontonummer for fakturautbetaling (format: NNNN.NN.NNNNN) */
  bankkontonr?: string;
  /** Standard betalingsfrist i dager (f.eks. 14 eller 30) */
  betalingsbetingelseDager?: number;
  /** Valgfri bunntekst på fakturaer (f.eks. "Faktura merkes med org.nr.") */
  fakturaBunntekst?: string;
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
  /** Prosjekt-ID — for prosjektregnskap og kostnadssted (#40) */
  prosjektId?: string;
  /** Godkjenningskjede — attestasjon og anvisning (#128) */
  godkjenning?: Godkjenningskjede;
};

// ─── Godkjenningskjede (#128) ─────────────────────────────────────────────────

/** Rolle i godkjenningskjeden */
export type GodkjenningRolle = "attestant" | "anviser";

/** Status på ett enkelt godkjenningstrinn */
export type GodkjenningTrinnStatus = "venter" | "godkjent" | "avvist";

/** Ett steg i godkjenningskjeden (attestasjon eller anvisning) */
export type GodkjenningTrinn = {
  rolle: GodkjenningRolle;
  /** UID til godkjenneren (satt ved handling) */
  uid?: string;
  /** Visningsnavn */
  navn?: string;
  status: GodkjenningTrinnStatus;
  /** ISO-tidsstempel for handlingen */
  tidspunkt?: string;
  /** Valgfri kommentar fra godkjenneren */
  merknad?: string;
};

/**
 * Godkjenningskjede knyttet til et bilag.
 * Attestasjon bekrefter saklighet; anvisning godkjenner betaling.
 */
export type Godkjenningskjede = {
  attestasjon?: GodkjenningTrinn;
  anvisning?: GodkjenningTrinn;
  /** True = bilaget er ferdig behandlet i kjeden */
  ferdig: boolean;
};

/** Prosjekt — for prosjektregnskap og kostnadssted (#40) */
export type Prosjekt = {
  navn: string;
  beskrivelse?: string;
  klientId: string;
  /** ISO-dato for prosjektstart */
  startDato?: string;
  /** ISO-dato for prosjektslutt (null = pågående) */
  sluttDato?: string;
  /** Prosjektbudsjett i NOK */
  budsjett?: number;
  status: "aktiv" | "avsluttet" | "på vent";
  /** Prosjektleder (fritekst) */
  prosjektleder?: string;
  /** Farge for visning i UI (hex eller Tailwind-fargenavn) */
  farge?: string;
  opprettet: Date;
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

// ─── A-melding (#107) ────────────────────────────────────────────────────────

/** Ansatt registrert for A-melding-rapportering */
export type Ansatt = {
  klientId: string;
  /** Fødselsnummer / D-nummer (11 siffer) */
  fnr: string;
  navn: string;
  epost?: string;
  /** Arbeidsforholds-ID — unik per ansatt per arbeidsgiver */
  arbeidsforholdId: string;
  typeArbeidsforhold: "ordinaertArbeidsforhold" | "maritimtArbeidsforhold" | "frilanserOppdragstakerHonorarPersonerMm";
  ansettelsesdato: string;   // ISO-dato
  sluttdato?: string;        // ISO-dato — satt ved avslutning
  stillingsprosent: number;  // 0-100
  antallTimerPerUke: number; // f.eks. 37.5
  avloenningstype: "fastLoenn" | "timeloenn" | "provisjon" | "honorar";
  /** STYRK-08 yrke, 6 siffer */
  yrke: string;
  skattekommune: string; // 4-sifret kommunenummer
  aktiv: boolean;
  opprettet: Date;
};

/** Lønnsutbetaling for én måned, knyttet til en ansatt */
export type LonnsUtbetaling = {
  klientId: string;
  ansattId: string;            // Referanse til Ansatt-dokument
  arbeidsforholdId: string;
  kalendermaaned: string;      // "YYYY-MM"
  /** Brutto lønn/inntekt i NOK */
  bruttoLonn: number;
  /** Inntektstype — fastloenn, timeloenn, overtidsgodtjoerelse, etc. */
  inntektsBeskrivelse: "fastloenn" | "timeloenn" | "overtidsgodtjoerelse" | "bonus" | "feriepenger" | "sykepenger";
  opptjeningFra: string;       // ISO-dato
  opptjeningTil: string;       // ISO-dato
  /** Skattetrekk i NOK */
  skattetrekk: number;
  /** Arbeidsgiveravgift i NOK (beregnes automatisk) */
  arbeidsgiveravgift?: number;
  utbetaltDato: string;        // ISO-dato
  status: "kladd" | "sendt" | "bekreftet" | "feil";
  opprettet: Date;
};

/** Innsending av A-melding for én kalendermåned */
export type AmeldinInnsending = {
  klientId: string;
  kalendermaaned: string;   // "YYYY-MM"
  /** Skatteetatens meldingsId (UUID returnert fra API) */
  meldingsId?: string;
  /** Referansenummer fra Skatteetaten */
  referansenummer?: string;
  /** Tidspunkt innsendingen ble sendt */
  sendtTidspunkt?: Date;
  status: "kladd" | "sendt" | "akseptert" | "bekreftet" | "avvist" | "feil";
  /** Feilmelding fra Skatteetaten ved avvisning */
  feilmelding?: string;
  /** Antall arbeidsforhold inkludert */
  antallArbeidsforhold: number;
  /** Sum brutto lønn sendt inn */
  sumBruttoLonn: number;
  opprettet: Date;
};

// ─── Regnskapsperioder (#116) ─────────────────────────────────────────────────

/** Status for en regnskapsperiode (måned) */
export type PeriodeStatus = "åpen" | "låst" | "lukket";

/**
 * En regnskapsperiode representerer én kalendermåned.
 * Lagres i `users/{uid}/regnskapsperioder` med ID `{klientId ?? "global"}-{YYYY-MM}`.
 *
 * Låst: ingen nye bilag kan bokføres i perioden.
 * Lukket: endelig avsluttet — kan ikke gjenåpnes.
 */
export type Regnskapsperiode = {
  /** klientId eller "global" for periodeutstrekning på tvers av klienter */
  klientId: string;
  /** ISO-år, f.eks. 2026 */
  år: number;
  /** 1–12 */
  måned: number;
  status: PeriodeStatus;
  /** UID til brukeren som låste/lukket perioden */
  lukketAv?: string;
  /** ISO-tidsstempel — når perioden ble låst/lukket */
  lukketTidspunkt?: string;
  /** Valgfritt notat om perioden */
  merknad?: string;
  opprettet?: Date;
};

// ─── Fakturamodul (utgående fakturaer) ───────────────────────────────────────

/** Status for en utgående faktura */
export type FakturaStatus =
  | "kladd"       // Ikke sendt
  | "sendt"       // Sendt til kunde
  | "betalt"      // Betalt av kunde
  | "forfalt"     // Etter forfallsdato, ikke betalt
  | "kreditert";  // Kreditert/annullert

/** Én linje på en faktura */
export type FakturaLinje = {
  beskrivelse: string;
  antall: number;
  enhetspris: number;   // ekskl. MVA
  mvaKode: "25" | "15" | "12" | "0" | "fritak";
  /** Prosentsats for valgt kode */
  mvaSats: number;      // 0, 12, 15 eller 25
  /** Rabatt i prosent (0–100) */
  rabatt?: number;
};

/**
 * Utgående faktura.
 * Lagres i `users/{uid}/fakturaer`.
 * Fakturanummeret tildeles sekvensielt per år (FF-YYYY-NNNN).
 */
export type Faktura = {
  /** Sekvensielt fakturanummer, f.eks. 10001 */
  fakturanr: number;
  /** Formatert fakturanummer, f.eks. "FF-2026-10001" */
  fakturanrFormatert: string;
  klientId: string;
  /** Motpart-ID (kunde) */
  motpartId: string;
  /** Kundenavn (snapshot for historikk) */
  kundeNavn: string;
  /** Kundens org.nr. (snapshot) */
  kundeOrgnr?: string;
  /** ISO-dato for fakturaen */
  dato: string;
  /** ISO-dato for forfall (typisk dato + 14 dager per NL § 10) */
  forfallsDato: string;
  linjer: FakturaLinje[];
  /** Sum ekskl. MVA */
  sumEksMva: number;
  /** Sum MVA */
  sumMva: number;
  /** Sum inkl. MVA */
  sumInkMva: number;
  status: FakturaStatus;
  /** Bilag-ID som ble opprettet da fakturaen ble bokført */
  bilagId?: string;
  /** Valgfri betalingsreferanse (KID / melding) */
  kid?: string;
  /** Bankkontonummer for betaling */
  bankkontonr?: string;
  /** Valgfri fritekst i bunntekst */
  bunntekst?: string;
  /** ISO-dato for betaling */
  betaltDato?: string;
  /** Purre-status for fakturaen */
  purring?: {
    antall: number;          // Antall purringer sendt
    sistePurringDato: string; // ISO-dato
    inkasso?: boolean;        // True hvis oversendt inkasso (etter 3 purringer)
  };
  opprettet: Date;
};

/** Aktivitetslogg for agenten */
export type AgentAktivitet = {
  type: "bokføring" | "forslag" | "rapport" | "epost" | "avstemming";
  beskrivelse: string;
  tidspunkt: Date;
  klientId?: string;
  bilagId?: string;
};
