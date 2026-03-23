/**
 * MVA-melding RF-0002 XML-eksport
 *
 * Genererer MVA-melding i Skatteetatens RF-0002-format (v2.0) klar for
 * innlevering via Altinn eller Skatteetatens API.
 *
 * Referanser:
 *  - Mval. § 15-7 (opplysningsplikt)
 *  - Mval. § 15-9 (frister: 10. april, 10. juni, 31. august, 10. oktober, 10. desember, 10. februar)
 *  - Skatteetatens RF-0002 skjema versjon 2.0
 */

import type { MvaTerm } from "@/hooks/use-rapporter";
import type { Klient } from "@/types";

/** Én linje i MVA-meldingen — tilsvarer ett post i RF-0002 */
export type MvaMeldingPost = {
  /** Kode fra SAF-T MVA-kodesystemet */
  kode: string;
  /** Beskrivelse av posten */
  beskrivelse: string;
  /** Grunnlag (omsetning eks. MVA) i øre */
  grunnlag: number;
  /** MVA-beløp i øre */
  mvaBeløp: number;
  /** Merknadstype: utgående, inngående eller kompensasjon */
  type: "utgåendeMva" | "inngåendeMva";
};

/** Komplett MVA-melding for én termin */
export type MvaMelding = {
  klientOrgnr: string;
  klientNavn: string;
  termin: string;       // f.eks. "1. termin 2026"
  terminKode: string;   // f.eks. "2026-T1"
  /** Terminfrist ISO-dato */
  frist: string;
  poster: MvaMeldingPost[];
  sumUtgåendeMva: number;
  sumInngåendeMva: number;
  /** Netto å betale (positiv = betale til Skatteetaten, negativ = til gode) */
  nettoÅBetale: number;
  /** Genereringstidspunkt ISO */
  generertTidspunkt: string;
};

/** Beregn terminens frist (10. i måneden to måneder etter terminens slutt) */
function beregnFrist(år: number, terminNr: number): string {
  // Termin 1: jan-feb → frist 10. april
  // Termin 2: mar-apr → frist 10. juni
  // Termin 3: mai-jun → frist 31. august
  // Termin 4: jul-aug → frist 10. oktober
  // Termin 5: sep-okt → frist 10. desember
  // Termin 6: nov-des → frist 10. februar neste år
  const fristMåneder: Record<number, [number, number, number]> = {
    1: [år, 4, 10],
    2: [år, 6, 10],
    3: [år, 8, 31],
    4: [år, 10, 10],
    5: [år, 12, 10],
    6: [år + 1, 2, 10],
  };
  const [fÅr, fMnd, fDag] = fristMåneder[terminNr] ?? [år, 12, 31];
  return `${fÅr}-${String(fMnd).padStart(2, "0")}-${String(fDag).padStart(2, "0")}`;
}

/** Konverter MvaTerm fra useRapporter til MvaMelding */
export function byggMvaMelding(
  termin: MvaTerm,
  klient: Pick<Klient, "orgnr" | "navn">
): MvaMelding {
  const [år, terminPart] = termin.periode.split("-T");
  const terminNr = parseInt(terminPart, 10);
  const regnskapsår = parseInt(år, 10);

  const månedNavn = ["", "jan-feb", "mar-apr", "mai-jun", "jul-aug", "sep-okt", "nov-des"];
  const terminLabel = `${terminNr}. termin ${regnskapsår} (${månedNavn[terminNr] ?? ""})`;

  // Utgående MVA — kode 3 (innenlands salg 25 %)
  const utgående: MvaMeldingPost = {
    kode: "3",
    beskrivelse: "Innenlands salg / uttak, høy sats (25 %)",
    grunnlag: Math.round(termin.utgåendeMva / 0.25),
    mvaBeløp: Math.round(termin.utgåendeMva),
    type: "utgåendeMva",
  };

  // Inngående MVA — kode 1 (innenlands kjøp 25 %)
  const inngående: MvaMeldingPost = {
    kode: "1",
    beskrivelse: "Innenlands kjøp, høy sats (25 %)",
    grunnlag: Math.round(termin.inngåendeMva / 0.25),
    mvaBeløp: Math.round(termin.inngåendeMva),
    type: "inngåendeMva",
  };

  const poster: MvaMeldingPost[] = [];
  if (termin.utgåendeMva !== 0) poster.push(utgående);
  if (termin.inngåendeMva !== 0) poster.push(inngående);

  return {
    klientOrgnr: klient.orgnr,
    klientNavn: klient.navn,
    termin: terminLabel,
    terminKode: termin.periode,
    frist: beregnFrist(regnskapsår, terminNr),
    poster,
    sumUtgåendeMva: Math.round(termin.utgåendeMva),
    sumInngåendeMva: Math.round(termin.inngåendeMva),
    nettoÅBetale: Math.round(termin.åBetale),
    generertTidspunkt: new Date().toISOString(),
  };
}

/** Escape XML-special-tegn */
function xe(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Generer RF-0002 XML for en MVA-termin.
 * XML-strukturen følger Skatteetatens xsd mvamelding versjon 2.0.
 */
export function genererMvaMeldingXml(melding: MvaMelding): string {
  const posteLinjer = melding.poster
    .map((p) => {
      const typeAttr = p.type === "utgåendeMva" ? "utgåendeMva" : "inngåendeMva";
      return `    <mvaSpesifikasjonslinje>
      <kode>${xe(p.kode)}</kode>
      <beskrivelse>${xe(p.beskrivelse)}</beskrivelse>
      <type>${typeAttr}</type>
      ${p.grunnlag !== 0 ? `<grunnlag>${p.grunnlag}</grunnlag>` : ""}
      <sats>${p.mvaBeløp > 0 ? (p.kode === "1" || p.kode === "81" ? 25 : 25) : 0}</sats>
      <mvaBeloep>${p.mvaBeløp}</mvaBeloep>
    </mvaSpesifikasjonslinje>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<mvamelding xmlns="urn:no:skatteetaten:fastsetting:avgift:mva:mvamelding:v2.0">
  <innsending>
    <organisasjonsnummer>${xe(melding.klientOrgnr)}</organisasjonsnummer>
    <skattepliktigNavn>${xe(melding.klientNavn)}</skattepliktigNavn>
    <termintype>toMaaneder</termintype>
    <terminkode>${xe(melding.terminKode)}</terminkode>
    <termin>${xe(melding.termin)}</termin>
    <frist>${melding.frist}</frist>
    <generertTidspunkt>${melding.generertTidspunkt}</generertTidspunkt>
  </innsending>
  <skattegrunnlagOgBeregnetSkatt>
${posteLinjer}
  </skattegrunnlagOgBeregnetSkatt>
  <mvaAvgift>
    <fastsattMerverdiavgift>${melding.nettoÅBetale}</fastsattMerverdiavgift>
    <sumUtgåendeMva>${melding.sumUtgåendeMva}</sumUtgåendeMva>
    <sumInngåendeMva>${melding.sumInngåendeMva}</sumInngåendeMva>
  </mvaAvgift>
</mvamelding>`;
}

/** Last ned RF-0002 XML som fil */
export function lastNedMvaMeldingXml(melding: MvaMelding): void {
  const xml = genererMvaMeldingXml(melding);
  const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const terminSikker = melding.terminKode.replace(/[^a-zA-Z0-9-]/g, "-");
  a.href = url;
  a.download = `mva-melding-RF0002-${melding.klientOrgnr}-${terminSikker}.xml`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Formater beløp i norsk format */
export function fmtMvaBeløp(øre: number): string {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(øre);
}

/** MVA-terminer for et år (6 stk, jan-feb … nov-des) */
export function mvaTerminFrister(år: number): {
  terminNr: number;
  periode: string;
  måneder: string;
  frist: string;
}[] {
  const månedNavn = ["", "jan-feb", "mar-apr", "mai-jun", "jul-aug", "sep-okt", "nov-des"];
  return [1, 2, 3, 4, 5, 6].map((t) => ({
    terminNr: t,
    periode: `${år}-T${t}`,
    måneder: månedNavn[t] ?? "",
    frist: beregnFrist(år, t),
  }));
}
