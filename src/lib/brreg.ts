/**
 * Brønnøysundregistrene Enhetsregisteret API-klient.
 * Offentlig REST API — ingen autentisering nødvendig.
 * Dokumentasjon: https://data.brreg.no/enhetsregisteret/api/docs/index.html
 */

export type BrregEnhet = {
  organisasjonsnummer: string;
  navn: string;
  organisasjonsform?: { kode: string; beskrivelse: string };
  registreringsdatoEnhetsregisteret?: string;
  stiftelsesdato?: string;
  naeringskode1?: { kode: string; beskrivelse: string };
  forretningsadresse?: {
    adresse?: string[];
    postnummer?: string;
    poststed?: string;
    kommune?: string;
    land?: string;
  };
  registrertIMvaregisteret?: boolean;
  antallAnsatte?: number;
  konkurs?: boolean;
  underAvvikling?: boolean;
};

export type BrregResultat =
  | { ok: true; enhet: BrregEnhet }
  | { ok: false; feil: "ikke_funnet" | "ugyldig_orgnr" | "nettverksfeil" };

const BASE = "https://data.brreg.no/enhetsregisteret/api/enheter";

/** Hent selskapsinfo fra Brønnøysundregistrene */
export async function hentEnhet(orgnr: string): Promise<BrregResultat> {
  const sifre = orgnr.replace(/\s/g, "");
  if (!/^\d{9}$/.test(sifre)) return { ok: false, feil: "ugyldig_orgnr" };

  try {
    const res = await fetch(`${BASE}/${sifre}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });

    if (res.status === 404) return { ok: false, feil: "ikke_funnet" };
    if (!res.ok) return { ok: false, feil: "nettverksfeil" };

    const enhet: BrregEnhet = await res.json();
    return { ok: true, enhet };
  } catch {
    return { ok: false, feil: "nettverksfeil" };
  }
}

/** Formater forretningsadresse til én streng */
export function formaterAdresse(enhet: BrregEnhet): string {
  const adr = enhet.forretningsadresse;
  if (!adr) return "";
  const gate = (adr.adresse ?? []).join(", ");
  const sted = [adr.postnummer, adr.poststed].filter(Boolean).join(" ");
  return [gate, sted].filter(Boolean).join(", ");
}

/** Gjett bransje fra næringskode */
export function gjettBransje(enhet: BrregEnhet): string | undefined {
  const kode = enhet.naeringskode1?.kode ?? "";
  const desc = enhet.naeringskode1?.beskrivelse ?? "";

  if (kode.startsWith("41") || kode.startsWith("42") || kode.startsWith("43")) return "Bygg og anlegg";
  if (kode.startsWith("56") || kode.startsWith("55")) return "Restaurant og servering";
  if (kode.startsWith("62") || kode.startsWith("63") || kode.startsWith("58")) return "IT og teknologi";
  if (kode.startsWith("69") || kode.startsWith("70") || kode.startsWith("73")) return "Konsulentvirksomhet";
  if (kode.startsWith("47") || kode.startsWith("46") || kode.startsWith("45")) return "Handel";
  if (kode.startsWith("86") || kode.startsWith("87") || kode.startsWith("88")) return "Helse og omsorg";

  // Fallback: bruk næringskode-beskrivelse direkte (maks 30 tegn)
  return desc ? desc.slice(0, 30) : undefined;
}
