// NS 4102 standard norsk kontoplan
// Kildegrunnlag: Norsk Standard NS 4102

import type { Konto } from "@/types";
export type { MvaKode, MvaType, MvaSats } from "@/lib/mva-koder";
export { MVA_KODER, MVA_KODER_VANLIGE, finnMvaKode, defaultMvaKodeForKonto } from "@/lib/mva-koder";

export type KontoMedGruppe = Konto & {
  gruppe: string;
  aktiv: boolean;
};

/** Standard NS 4102-kontoplan med de vanligste kontoene */
export const NS4102_KONTOPLAN: KontoMedGruppe[] = [
  // ─── Klasse 1: Eiendeler ────────────────────────────────────────────────────
  { nummer: "1000", navn: "Forskning og utvikling", type: "eiendel", gruppe: "Immaterielle eiendeler", aktiv: true },
  { nummer: "1020", navn: "Patenter og rettigheter", type: "eiendel", gruppe: "Immaterielle eiendeler", aktiv: true },
  { nummer: "1080", navn: "Goodwill", type: "eiendel", gruppe: "Immaterielle eiendeler", aktiv: true },
  { nummer: "1100", navn: "Tomter og bygninger", type: "eiendel", gruppe: "Varige driftsmidler", aktiv: true },
  { nummer: "1110", navn: "Bygg og anlegg", type: "eiendel", gruppe: "Varige driftsmidler", aktiv: true },
  { nummer: "1120", navn: "Tekniske anlegg og maskiner", type: "eiendel", gruppe: "Varige driftsmidler", aktiv: true },
  { nummer: "1200", navn: "Maskiner og inventar", type: "eiendel", gruppe: "Varige driftsmidler", aktiv: true },
  { nummer: "1210", navn: "Kontormaskiner og EDB-utstyr", type: "eiendel", gruppe: "Varige driftsmidler", aktiv: true },
  { nummer: "1220", navn: "Inventar og innredning", type: "eiendel", gruppe: "Varige driftsmidler", aktiv: true },
  { nummer: "1230", navn: "Transportmidler", type: "eiendel", gruppe: "Varige driftsmidler", aktiv: true },
  { nummer: "1400", navn: "Varelager", type: "eiendel", gruppe: "Omløpsmidler", aktiv: true },
  { nummer: "1500", navn: "Kundefordringer", type: "eiendel", gruppe: "Omløpsmidler", aktiv: true },
  { nummer: "1510", navn: "Opptjente ikke fakturerte inntekter", type: "eiendel", gruppe: "Omløpsmidler", aktiv: true },
  { nummer: "1530", navn: "Andre fordringer", type: "eiendel", gruppe: "Omløpsmidler", aktiv: true },
  { nummer: "1700", navn: "Forskuddsbetalte kostnader", type: "eiendel", gruppe: "Omløpsmidler", aktiv: true },
  { nummer: "1750", navn: "Kortsiktige fordringer", type: "eiendel", gruppe: "Omløpsmidler", aktiv: true },
  { nummer: "1800", navn: "Aksjer og andeler", type: "eiendel", gruppe: "Finansielle eiendeler", aktiv: true },
  { nummer: "1900", navn: "Bankinnskudd", type: "eiendel", gruppe: "Likviditetsreserver", aktiv: true },
  { nummer: "1910", navn: "Kontanter", type: "eiendel", gruppe: "Likviditetsreserver", aktiv: true },
  { nummer: "1920", navn: "Bankinnskudd, driftskonto", type: "eiendel", gruppe: "Likviditetsreserver", aktiv: true },
  { nummer: "1940", navn: "Skattetrekkskonto", type: "eiendel", gruppe: "Likviditetsreserver", aktiv: true },

  // ─── Klasse 2: Egenkapital og gjeld ─────────────────────────────────────────
  { nummer: "2000", navn: "Aksjekapital / innskutt egenkapital", type: "egenkapital", gruppe: "Egenkapital", aktiv: true },
  { nummer: "2020", navn: "Overkursfond", type: "egenkapital", gruppe: "Egenkapital", aktiv: true },
  { nummer: "2050", navn: "Annen egenkapital", type: "egenkapital", gruppe: "Egenkapital", aktiv: true },
  { nummer: "2080", navn: "Udekket tap", type: "egenkapital", gruppe: "Egenkapital", aktiv: true },
  { nummer: "2100", navn: "Langsiktig gjeld til kredittinstitusjoner", type: "gjeld", gruppe: "Langsiktig gjeld", aktiv: true },
  { nummer: "2150", navn: "Pantelån", type: "gjeld", gruppe: "Langsiktig gjeld", aktiv: true },
  { nummer: "2300", navn: "Kortsiktig gjeld til kredittinstitusjoner", type: "gjeld", gruppe: "Kortsiktig gjeld", aktiv: true },
  { nummer: "2400", navn: "Leverandørgjeld", type: "gjeld", gruppe: "Kortsiktig gjeld", aktiv: true },
  { nummer: "2500", navn: "Skyldige offentlige avgifter", type: "gjeld", gruppe: "Kortsiktig gjeld", aktiv: true },
  { nummer: "2600", navn: "Skattetrekk og arbeidsgiveravgift", type: "gjeld", gruppe: "Kortsiktig gjeld", aktiv: true },
  { nummer: "2610", navn: "Skyldig arbeidsgiveravgift", type: "gjeld", gruppe: "Kortsiktig gjeld", aktiv: true },
  { nummer: "2700", navn: "Skyldig MVA", type: "gjeld", gruppe: "MVA", aktiv: true },
  { nummer: "2710", navn: "Inngående MVA, høy sats (25%)", type: "gjeld", mvaKode: "1",  gruppe: "MVA", aktiv: true },
  { nummer: "2711", navn: "Inngående MVA, middels sats (15%)", type: "gjeld", mvaKode: "11", gruppe: "MVA", aktiv: true },
  { nummer: "2712", navn: "Inngående MVA, lav sats (12%)", type: "gjeld", mvaKode: "12", gruppe: "MVA", aktiv: true },
  { nummer: "2740", navn: "Utgående MVA, høy sats (25%)", type: "gjeld", mvaKode: "3",  gruppe: "MVA", aktiv: true },
  { nummer: "2741", navn: "Utgående MVA, middels sats (15%)", type: "gjeld", mvaKode: "5",  gruppe: "MVA", aktiv: true },
  { nummer: "2742", navn: "Utgående MVA, lav sats (12%)", type: "gjeld", mvaKode: "6",  gruppe: "MVA", aktiv: true },
  { nummer: "2800", navn: "Annen kortsiktig gjeld", type: "gjeld", gruppe: "Kortsiktig gjeld", aktiv: true },
  { nummer: "2900", navn: "Avsatte feriepenger", type: "gjeld", gruppe: "Kortsiktig gjeld", aktiv: true },
  { nummer: "2910", navn: "Skyldig lønn", type: "gjeld", gruppe: "Kortsiktig gjeld", aktiv: true },
  { nummer: "2950", navn: "Forskuddsbetalt inntekt", type: "gjeld", gruppe: "Kortsiktig gjeld", aktiv: true },

  // ─── Klasse 3: Driftsinntekter ──────────────────────────────────────────────
  { nummer: "3000", navn: "Salgsinntekter, avgiftspliktig", type: "inntekt", mvaKode: "3", gruppe: "Driftsinntekter", aktiv: true },
  { nummer: "3010", navn: "Salgsinntekter, avgiftspliktig (varer)", type: "inntekt", mvaKode: "3", gruppe: "Driftsinntekter", aktiv: true },
  { nummer: "3020", navn: "Salgsinntekter, avgiftspliktig (tjenester)", type: "inntekt", mvaKode: "3", gruppe: "Driftsinntekter", aktiv: true },
  { nummer: "3100", navn: "Salgsinntekter, avgiftsfri", type: "inntekt", gruppe: "Driftsinntekter", aktiv: true },
  { nummer: "3200", navn: "Leieinntekter, avgiftspliktig", type: "inntekt", mvaKode: "3", gruppe: "Driftsinntekter", aktiv: true },
  { nummer: "3210", navn: "Leieinntekter, avgiftsfri", type: "inntekt", gruppe: "Driftsinntekter", aktiv: true },
  { nummer: "3400", navn: "Provisjonsinntekter", type: "inntekt", mvaKode: "3", gruppe: "Driftsinntekter", aktiv: true },
  { nummer: "3600", navn: "Offentlige tilskudd", type: "inntekt", gruppe: "Driftsinntekter", aktiv: true },
  { nummer: "3700", navn: "Gevinst ved avgang av driftsmidler", type: "inntekt", gruppe: "Driftsinntekter", aktiv: true },
  { nummer: "3900", navn: "Andre driftsinntekter", type: "inntekt", gruppe: "Driftsinntekter", aktiv: true },

  // ─── Klasse 4: Varekostnad ──────────────────────────────────────────────────
  { nummer: "4000", navn: "Innkjøp av råvarer og halvfabrikata", type: "kostnad", mvaKode: "1", gruppe: "Varekostnad", aktiv: true },
  { nummer: "4100", navn: "Innkjøp av handelsvarer", type: "kostnad", mvaKode: "1", gruppe: "Varekostnad", aktiv: true },
  { nummer: "4300", navn: "Beholdningsendring ferdigvarer", type: "kostnad", gruppe: "Varekostnad", aktiv: true },
  { nummer: "4500", navn: "Fremmedytelser og underentreprenører", type: "kostnad", mvaKode: "1", gruppe: "Varekostnad", aktiv: true },
  { nummer: "4600", navn: "Frakt og transportkostnader", type: "kostnad", mvaKode: "1", gruppe: "Varekostnad", aktiv: true },

  // ─── Klasse 5: Lønnskostnader ────────────────────────────────────────────────
  { nummer: "5000", navn: "Lønn til ansatte", type: "kostnad", gruppe: "Lønnskostnader", aktiv: true },
  { nummer: "5010", navn: "Fastlønn", type: "kostnad", gruppe: "Lønnskostnader", aktiv: true },
  { nummer: "5020", navn: "Overtid", type: "kostnad", gruppe: "Lønnskostnader", aktiv: true },
  { nummer: "5040", navn: "Bonus og provisjon", type: "kostnad", gruppe: "Lønnskostnader", aktiv: true },
  { nummer: "5060", navn: "Feriepenger", type: "kostnad", gruppe: "Lønnskostnader", aktiv: true },
  { nummer: "5100", navn: "Arbeidsgiveravgift", type: "kostnad", gruppe: "Lønnskostnader", aktiv: true },
  { nummer: "5200", navn: "Pensjonskostnader", type: "kostnad", gruppe: "Lønnskostnader", aktiv: true },
  { nummer: "5300", navn: "Sykepenger og forsikringer", type: "kostnad", gruppe: "Lønnskostnader", aktiv: true },
  { nummer: "5400", navn: "Styrehonorar", type: "kostnad", gruppe: "Lønnskostnader", aktiv: true },
  { nummer: "5500", navn: "Annen personalkostnad", type: "kostnad", gruppe: "Lønnskostnader", aktiv: true },
  { nummer: "5800", navn: "Reisekostnader, ansatte", type: "kostnad", gruppe: "Lønnskostnader", aktiv: true },
  { nummer: "5900", navn: "Bil- og reisekostnader", type: "kostnad", gruppe: "Lønnskostnader", aktiv: true },

  // ─── Klasse 6: Av- og nedskrivninger + andre driftskostnader ────────────────
  { nummer: "6000", navn: "Avskrivning på varige driftsmidler", type: "kostnad", gruppe: "Av- og nedskrivninger", aktiv: true },
  { nummer: "6010", navn: "Avskrivning på immaterielle eiendeler", type: "kostnad", gruppe: "Av- og nedskrivninger", aktiv: true },
  { nummer: "6100", navn: "Frakt og transport", type: "kostnad", mvaKode: "1", gruppe: "Andre driftskostnader", aktiv: true },
  { nummer: "6200", navn: "Eiendomskostnader", type: "kostnad", mvaKode: "1", gruppe: "Andre driftskostnader", aktiv: true },
  { nummer: "6210", navn: "Husleie", type: "kostnad", gruppe: "Andre driftskostnader", aktiv: true },
  { nummer: "6300", navn: "Leie av maskiner og annet utstyr", type: "kostnad", mvaKode: "1", gruppe: "Andre driftskostnader", aktiv: true },
  { nummer: "6340", navn: "Leie av bil", type: "kostnad", mvaKode: "1", gruppe: "Andre driftskostnader", aktiv: true },
  { nummer: "6400", navn: "Reparasjon og vedlikehold", type: "kostnad", mvaKode: "1", gruppe: "Andre driftskostnader", aktiv: true },
  { nummer: "6500", navn: "Verktøy, inventar og driftsmateriell", type: "kostnad", mvaKode: "1", gruppe: "Andre driftskostnader", aktiv: true },
  { nummer: "6540", navn: "Reisekostnader, ikke ansatte", type: "kostnad", mvaKode: "1", gruppe: "Andre driftskostnader", aktiv: true },
  { nummer: "6600", navn: "Kontorkostnader", type: "kostnad", mvaKode: "1", gruppe: "Andre driftskostnader", aktiv: true },
  { nummer: "6700", navn: "Trykksaker og kontorrekvisita", type: "kostnad", mvaKode: "1", gruppe: "Andre driftskostnader", aktiv: true },
  { nummer: "6720", navn: "Aviser og tidsskrifter", type: "kostnad", mvaKode: "1", gruppe: "Andre driftskostnader", aktiv: true },
  { nummer: "6730", navn: "Strøm, fyring og vann", type: "kostnad", mvaKode: "1", gruppe: "Andre driftskostnader", aktiv: true },
  { nummer: "6740", navn: "Renovasjon, vann og avløp", type: "kostnad", mvaKode: "1", gruppe: "Andre driftskostnader", aktiv: true },
  { nummer: "6800", navn: "Reklame og annonse", type: "kostnad", mvaKode: "1", gruppe: "Salgs- og markedsføringskostnader", aktiv: true },
  { nummer: "6860", navn: "Programvare og lisenser", type: "kostnad", mvaKode: "1", gruppe: "Andre driftskostnader", aktiv: true },
  { nummer: "6900", navn: "Telekommunikasjon", type: "kostnad", mvaKode: "1", gruppe: "Andre driftskostnader", aktiv: true },
  { nummer: "6940", navn: "Porto og frakt", type: "kostnad", mvaKode: "1", gruppe: "Andre driftskostnader", aktiv: true },

  // ─── Klasse 7: Andre driftskostnader ────────────────────────────────────────
  { nummer: "7000", navn: "Driftsmateriell og forbruksartikler", type: "kostnad", mvaKode: "1", gruppe: "Andre driftskostnader", aktiv: true },
  { nummer: "7100", navn: "Frakt og transportkostnader, viderefakturert", type: "kostnad", mvaKode: "1", gruppe: "Andre driftskostnader", aktiv: true },
  { nummer: "7320", navn: "Revisjon og regnskapshjelp", type: "kostnad", mvaKode: "1", gruppe: "Administrativt", aktiv: true },
  { nummer: "7350", navn: "Juridisk bistand", type: "kostnad", mvaKode: "1", gruppe: "Administrativt", aktiv: true },
  { nummer: "7400", navn: "Kontingenter", type: "kostnad", gruppe: "Administrativt", aktiv: true },
  { nummer: "7410", navn: "Faglig oppdatering", type: "kostnad", mvaKode: "1", gruppe: "Administrativt", aktiv: true },
  { nummer: "7500", navn: "Forsikringspremier", type: "kostnad", gruppe: "Administrativt", aktiv: true },
  { nummer: "7700", navn: "Garantikostnader", type: "kostnad", gruppe: "Andre driftskostnader", aktiv: true },
  { nummer: "7770", navn: "Bank- og finanskostnader", type: "kostnad", gruppe: "Finanskostnader", aktiv: true },
  { nummer: "7800", navn: "Tap på fordringer", type: "kostnad", gruppe: "Andre driftskostnader", aktiv: true },
  { nummer: "7900", navn: "Andre driftskostnader", type: "kostnad", gruppe: "Andre driftskostnader", aktiv: true },

  // ─── Klasse 8: Finansposter ──────────────────────────────────────────────────
  { nummer: "8000", navn: "Inntekt på investering i datterselskaper", type: "inntekt", gruppe: "Finansinntekter", aktiv: true },
  { nummer: "8050", navn: "Renteinntekter", type: "inntekt", gruppe: "Finansinntekter", aktiv: true },
  { nummer: "8060", navn: "Kursgevinst valuta", type: "inntekt", gruppe: "Finansinntekter", aktiv: true },
  { nummer: "8100", navn: "Rentekostnader", type: "kostnad", gruppe: "Finanskostnader", aktiv: true },
  { nummer: "8160", navn: "Kurstap valuta", type: "kostnad", gruppe: "Finanskostnader", aktiv: true },
  { nummer: "8200", navn: "Skattekostnad", type: "kostnad", gruppe: "Skatter og avgifter", aktiv: true },
  { nummer: "8300", navn: "Ekstraordinære inntekter", type: "inntekt", gruppe: "Ekstraordinære poster", aktiv: true },
  { nummer: "8400", navn: "Ekstraordinære kostnader", type: "kostnad", gruppe: "Ekstraordinære poster", aktiv: true },
  { nummer: "8800", navn: "Årsresultat", type: "egenkapital", gruppe: "Årsresultat", aktiv: true },
  { nummer: "8960", navn: "Overføring til/fra annen egenkapital", type: "egenkapital", gruppe: "Årsresultat", aktiv: true },
];

/** Finn konto på nummer */
export function finnKonto(nummer: string): KontoMedGruppe | undefined {
  return NS4102_KONTOPLAN.find((k) => k.nummer === nummer);
}

/** Søk i kontoplan */
export function søkKontoplan(søk: string): KontoMedGruppe[] {
  const s = søk.toLowerCase().trim();
  if (!s) return NS4102_KONTOPLAN.filter((k) => k.aktiv);
  return NS4102_KONTOPLAN.filter(
    (k) =>
      k.aktiv &&
      (k.nummer.includes(s) || k.navn.toLowerCase().includes(s) || k.gruppe.toLowerCase().includes(s))
  );
}

/** Kontoklasse basert på kontonummer */
export function kontoKlasse(nummer: string): string {
  const cls = nummer[0];
  const map: Record<string, string> = {
    "1": "Eiendeler",
    "2": "Egenkapital og gjeld",
    "3": "Inntekter",
    "4": "Varekostnad",
    "5": "Lønnskostnader",
    "6": "Andre driftskostnader",
    "7": "Andre driftskostnader",
    "8": "Finansposter",
  };
  return map[cls] ?? "Ukjent";
}
