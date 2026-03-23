/**
 * Eksportverktøy — CSV-generering for bilag, rapporter og klienter.
 * All eksport skjer klient-side via Blob + URL.createObjectURL.
 *
 * PDF-eksport støttes via window.print() med @media print CSS —
 * brukeren velger "Lagre som PDF" i nettleserens utskriftsdialog.
 */

import type { BilagMedId } from "@/hooks/use-bilag";
import type { Klient, Motpart } from "@/types";
import type { Resultatregnskap } from "@/hooks/use-rapporter";

type MotpartMedId = Motpart & { id: string };

// ─── CSV-hjelper ─────────────────────────────────────────────────────────────

/** Escaper en CSV-celle (håndterer komma, anførselstegn og linjeskift) */
export function csvCelle(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Bygg en CSV-streng fra header og rader (inkl. UTF-8 BOM for Excel) */
export function byggCsv(headers: string[], rader: unknown[][]): string {
  const linjer = [
    headers.map(csvCelle).join(","),
    ...rader.map((r) => r.map(csvCelle).join(",")),
  ];
  // BOM for at Excel skal gjenkjenne UTF-8
  return "\uFEFF" + linjer.join("\r\n");
}

/** Last ned CSV som fil */
function lastNedCsv(innhold: string, filnavn: string): void {
  const blob = new Blob([innhold], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filnavn;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── NOK-formatering ─────────────────────────────────────────────────────────

export function nokStr(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

// ─── Bilagliste CSV ──────────────────────────────────────────────────────────

const BILAG_HEADERS = [
  "Bilagsnr",
  "Dato",
  "Beskrivelse",
  "KlientId",
  "Leverandør",
  "Motpart",
  "Beløp (NOK)",
  "Status",
  "Kategori",
  "Forfallsdato",
  "Antall posteringer",
  "Vedlegg",
  "Kreditert av (bilagsnr)",
  "Korrigerer bilag (bilagsnr)",
];

/** Ren funksjon: bygg CSV-innhold for bilagliste (uten nedlasting) */
export function byggBilagCsv(
  bilag: BilagMedId[],
  motparter?: MotpartMedId[]
): string {
  const motpartNavn = (id?: string) =>
    id ? (motparter?.find((m) => m.id === id)?.navn ?? id) : "";

  const bilagsnrById = new Map(bilag.map((b) => [b.id, b.bilagsnr]));

  const rader = bilag.map((b) => [
    b.bilagsnr,
    b.dato,
    b.beskrivelse,
    b.klientId,
    b.leverandor ?? "",
    motpartNavn(b.motpartId),
    nokStr(b.belop),
    b.status,
    b.kategori ?? "",
    b.forfallsDato ?? "",
    b.posteringer.length,
    b.vedleggUrl ? "Ja" : "Nei",
    b.kreditertAvId ? (bilagsnrById.get(b.kreditertAvId) ?? b.kreditertAvId) : "",
    b.korrigererBilagId ? (bilagsnrById.get(b.korrigererBilagId) ?? b.korrigererBilagId) : "",
  ]);

  return byggCsv(BILAG_HEADERS, rader);
}

/**
 * Eksporter bilagliste som CSV.
 * Én rad per bilag med alle kolonner; posteringer ikke inkludert.
 * Sender med motparter for oppslag av navn via motpartId.
 */
export function eksporterBilagCsv(
  bilag: BilagMedId[],
  motparter?: MotpartMedId[],
  filnavn?: string
): void {
  const dato = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  lastNedCsv(byggBilagCsv(bilag, motparter), filnavn ?? `bilag_${dato}.csv`);
}

const POSTERINGER_HEADERS = [
  "Bilagsnr",
  "Dato",
  "Beskrivelse bilag",
  "KlientId",
  "Motpart",
  "Status",
  "Kontonr",
  "Kontonavn",
  "Debet (NOK)",
  "Kredit (NOK)",
  "MVA-kode",
  "Beskrivelse linje",
];

/** Ren funksjon: bygg CSV-innhold for posteringsliste (uten nedlasting) */
export function byggPosteringerCsv(
  bilag: BilagMedId[],
  motparter?: MotpartMedId[]
): string {
  const motpartNavn = (id?: string) =>
    id ? (motparter?.find((m) => m.id === id)?.navn ?? id) : "";

  const rader: unknown[][] = [];
  for (const b of bilag) {
    for (const p of b.posteringer) {
      rader.push([
        b.bilagsnr,
        b.dato,
        b.beskrivelse,
        b.klientId,
        motpartNavn(b.motpartId),
        b.status,
        p.kontonr,
        p.kontonavn,
        nokStr(p.debet ?? 0),
        nokStr(p.kredit ?? 0),
        p.mvaKode ?? "",
        p.beskrivelse ?? "",
      ]);
    }
  }

  return byggCsv(POSTERINGER_HEADERS, rader);
}

/**
 * Eksporter detaljert posteringsliste som CSV.
 * Én rad per postering; nyttig for revisorer.
 * Sender med motparter for oppslag av navn via motpartId.
 */
export function eksporterPosteringerCsv(
  bilag: BilagMedId[],
  motparter?: MotpartMedId[],
  filnavn?: string
): void {
  const dato = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  lastNedCsv(byggPosteringerCsv(bilag, motparter), filnavn ?? `posteringer_${dato}.csv`);
}

// ─── Resultatregnskap CSV ─────────────────────────────────────────────────────

/** Ren funksjon: bygg CSV-innhold for resultatregnskap (uten nedlasting) */
export function byggResultatCsv(
  resultat: Resultatregnskap,
  periode: string
): string {
  const headers = ["Type", "Kontonr", "Kontonavn", "Beløp (NOK)"];

  const rader: unknown[][] = [
    ["--- DRIFTSINNTEKTER ---", "", "", ""],
    ...resultat.driftsinntekter.map((r) => ["Inntekt", r.konto, r.navn, nokStr(r.belop)]),
    ["Sum inntekter", "", "", nokStr(resultat.totalInntekter)],
    ["", "", "", ""],
    ["--- DRIFTSKOSTNADER ---", "", "", ""],
    ...resultat.driftskostnader.map((r) => ["Kostnad", r.konto, r.navn, nokStr(r.belop)]),
    ["Sum kostnader", "", "", nokStr(resultat.totalKostnader)],
    ["", "", "", ""],
    ["RESULTAT FØR SKATT", "", "", nokStr(resultat.resultat)],
  ];

  return byggCsv(headers, rader);
}

/** Eksporter resultatregnskap som CSV */
export function eksporterResultatCsv(
  resultat: Resultatregnskap,
  periode: string,
  filnavn?: string
): void {
  const periodeSlug = periode.replace(/[^a-zA-Z0-9-]/g, "_");
  const dato = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  lastNedCsv(byggResultatCsv(resultat, periode), filnavn ?? `resultatregnskap_${periodeSlug}_${dato}.csv`);
}

// ─── Klientliste CSV ──────────────────────────────────────────────────────────

const KLIENTER_HEADERS = [
  "Firmanavn",
  "Org.nr",
  "Kontaktperson",
  "E-post",
  "Telefon",
  "Bransje",
  "Adresse",
];

/** Ren funksjon: bygg CSV-innhold for klientliste (uten nedlasting) */
export function byggKlienterCsv(klienter: (Klient & { id: string })[]): string {
  const rader = klienter.map((k) => [
    k.navn,
    k.orgnr,
    k.kontaktperson,
    k.epost,
    k.telefon ?? "",
    k.bransje ?? "",
    k.adresse ?? "",
  ]);
  return byggCsv(KLIENTER_HEADERS, rader);
}

/** Eksporter klientliste som CSV */
export function eksporterKlienterCsv(
  klienter: (Klient & { id: string })[],
  filnavn?: string
): void {
  const dato = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  lastNedCsv(byggKlienterCsv(klienter), filnavn ?? `klienter_${dato}.csv`);
}
