/**
 * Eksportverktøy — CSV-generering for bilag, rapporter og klienter.
 * All eksport skjer klient-side via Blob + URL.createObjectURL.
 *
 * PDF-eksport støttes via window.print() med @media print CSS —
 * brukeren velger "Lagre som PDF" i nettleserens utskriftsdialog.
 */

import type { BilagMedId } from "@/hooks/use-bilag";
import type { Klient } from "@/types";
import type { Resultatregnskap } from "@/hooks/use-rapporter";

// ─── CSV-hjelper ─────────────────────────────────────────────────────────────

/** Escaper en CSV-celle (håndterer komma, anførselstegn og linjeskift) */
function csvCelle(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Bygg en CSV-streng fra header og rader */
function byggCsv(headers: string[], rader: unknown[][]): string {
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

function nokStr(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

// ─── Bilagliste CSV ──────────────────────────────────────────────────────────

/**
 * Eksporter bilagliste som CSV.
 * Én rad per bilag med alle kolonner; posteringer ikke inkludert.
 */
export function eksporterBilagCsv(bilag: BilagMedId[], filnavn?: string): void {
  const headers = [
    "Bilagsnr",
    "Dato",
    "Beskrivelse",
    "Leverandør",
    "Beløp (NOK)",
    "Status",
    "Kategori",
    "Antall posteringer",
  ];

  const rader = bilag.map((b) => [
    b.bilagsnr,
    b.dato,
    b.beskrivelse,
    b.leverandor ?? "",
    nokStr(b.belop),
    b.status,
    b.kategori ?? "",
    b.posteringer.length,
  ]);

  const dato = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  lastNedCsv(byggCsv(headers, rader), filnavn ?? `bilag_${dato}.csv`);
}

/**
 * Eksporter detaljert posteringsliste som CSV.
 * Én rad per postering; nyttig for revisorer.
 */
export function eksporterPosteringerCsv(bilag: BilagMedId[], filnavn?: string): void {
  const headers = [
    "Bilagsnr",
    "Dato",
    "Beskrivelse bilag",
    "Kontonr",
    "Kontonavn",
    "Debet (NOK)",
    "Kredit (NOK)",
    "MVA-kode",
    "Beskrivelse linje",
  ];

  const rader: unknown[][] = [];
  for (const b of bilag) {
    for (const p of b.posteringer) {
      rader.push([
        b.bilagsnr,
        b.dato,
        b.beskrivelse,
        p.kontonr,
        p.kontonavn,
        nokStr(p.debet ?? 0),
        nokStr(p.kredit ?? 0),
        p.mvaKode ?? "",
        p.beskrivelse ?? "",
      ]);
    }
  }

  const dato = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  lastNedCsv(byggCsv(headers, rader), filnavn ?? `posteringer_${dato}.csv`);
}

// ─── Resultatregnskap CSV ─────────────────────────────────────────────────────

/** Eksporter resultatregnskap som CSV */
export function eksporterResultatCsv(
  resultat: Resultatregnskap,
  periode: string,
  filnavn?: string
): void {
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

  const periodeSlug = periode.replace(/[^a-zA-Z0-9-]/g, "_");
  const dato = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  lastNedCsv(byggCsv(headers, rader), filnavn ?? `resultatregnskap_${periodeSlug}_${dato}.csv`);
}

// ─── Klientliste CSV ──────────────────────────────────────────────────────────

/** Eksporter klientliste som CSV */
export function eksporterKlienterCsv(
  klienter: (Klient & { id: string })[],
  filnavn?: string
): void {
  const headers = [
    "Firmanavn",
    "Org.nr",
    "Kontaktperson",
    "E-post",
    "Telefon",
    "Bransje",
    "Adresse",
  ];

  const rader = klienter.map((k) => [
    k.navn,
    k.orgnr,
    k.kontaktperson,
    k.epost,
    k.telefon ?? "",
    k.bransje ?? "",
    k.adresse ?? "",
  ]);

  const dato = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  lastNedCsv(byggCsv(headers, rader), filnavn ?? `klienter_${dato}.csv`);
}
