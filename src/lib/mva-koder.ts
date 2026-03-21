/**
 * SAF-T MVA-kodesystem for norsk MVA-melding og SAF-T-eksport.
 * Kilde: Skatteetatens SAF-T-standard for norsk regnskap.
 *
 * Kode-oppbygging:
 *  - 1–19:  Innenlands kjøp (inngående MVA)
 *  - 3–6:   Innenlands salg (utgående MVA)
 *  - 21–29: Kjøp med omvendt avgiftsplikt (inngående)
 *  - 31–33: Salg med omvendt avgiftsplikt (utgående)
 *  - 81–92: Import/eksport
 *  - 0:     Unntatt / utenfor MVA-loven
 */

export type MvaType = "inngående" | "utgående" | "unntatt";
export type MvaSats = 0 | 12 | 15 | 25;

export type MvaKode = {
  /** SAF-T MVA-kode (numerisk streng) */
  kode: string;
  /** Norsk beskrivelse */
  beskrivelse: string;
  /** MVA-type */
  type: MvaType;
  /** Prosentsats */
  sats: MvaSats;
  /** Brukes ofte (filtreringsverktøy) */
  vanlig: boolean;
};

/**
 * Komplette SAF-T MVA-koder for norsk regnskap.
 */
export const MVA_KODER: MvaKode[] = [
  // ─── Unntatt ──────────────────────────────────────────────────────────────
  { kode: "0",  beskrivelse: "Ingen MVA / unntak",                          type: "unntatt",   sats: 0,  vanlig: true  },

  // ─── Innenlands kjøp (inngående MVA) ──────────────────────────────────────
  { kode: "1",  beskrivelse: "Innenlands kjøp, høy sats (25 %)",            type: "inngående", sats: 25, vanlig: true  },
  { kode: "11", beskrivelse: "Innenlands kjøp, middels sats (15 %)",        type: "inngående", sats: 15, vanlig: true  },
  { kode: "12", beskrivelse: "Innenlands kjøp, lav sats (12 %)",            type: "inngående", sats: 12, vanlig: true  },
  { kode: "13", beskrivelse: "Innenlands kjøp, lav sats 11,11 %",           type: "inngående", sats: 12, vanlig: false },
  { kode: "14", beskrivelse: "Innenlands kjøp, lav sats – 100 % fradrag",   type: "inngående", sats: 12, vanlig: false },

  // ─── Innenlands salg (utgående MVA) ───────────────────────────────────────
  { kode: "3",  beskrivelse: "Innenlands salg / uttak, høy sats (25 %)",    type: "utgående",  sats: 25, vanlig: true  },
  { kode: "5",  beskrivelse: "Innenlands salg / uttak, middels sats (15 %)",type: "utgående",  sats: 15, vanlig: true  },
  { kode: "6",  beskrivelse: "Innenlands salg / uttak, lav sats (12 %)",    type: "utgående",  sats: 12, vanlig: true  },

  // ─── Omvendt avgiftsplikt innenlands (kjøper beregner MVA) ────────────────
  { kode: "21", beskrivelse: "Omvendt avgiftsplikt, kjøp, høy sats (25 %)", type: "inngående", sats: 25, vanlig: false },
  { kode: "22", beskrivelse: "Omvendt avgiftsplikt, kjøp, middels sats (15 %)", type: "inngående", sats: 15, vanlig: false },

  // ─── Omvendt avgiftsplikt innenlands (salg) ───────────────────────────────
  { kode: "31", beskrivelse: "Omvendt avgiftsplikt, salg, høy sats (25 %)", type: "utgående",  sats: 25, vanlig: false },
  { kode: "32", beskrivelse: "Omvendt avgiftsplikt, salg, middels sats (15 %)", type: "utgående", sats: 15, vanlig: false },
  { kode: "33", beskrivelse: "Omvendt avgiftsplikt, salg, lav sats (12 %)", type: "utgående",  sats: 12, vanlig: false },

  // ─── Import (kjøp fra utlandet) ───────────────────────────────────────────
  { kode: "81", beskrivelse: "Kjøp fra utlandet, høy sats (25 %)",          type: "inngående", sats: 25, vanlig: false },
  { kode: "82", beskrivelse: "Kjøp fra utlandet, middels sats (15 %)",      type: "inngående", sats: 15, vanlig: false },
  { kode: "83", beskrivelse: "Kjøp fra utlandet, lav sats (12 %)",          type: "inngående", sats: 12, vanlig: false },
  { kode: "84", beskrivelse: "Kjøp fra utlandet, omvendt avgiftsplikt, 25 %", type: "inngående", sats: 25, vanlig: false },
  { kode: "85", beskrivelse: "Kjøp fra utlandet, omvendt avgiftsplikt, 15 %", type: "inngående", sats: 15, vanlig: false },
  { kode: "86", beskrivelse: "Kjøp fra utlandet, omvendt avgiftsplikt, 12 %", type: "inngående", sats: 12, vanlig: false },
  { kode: "87", beskrivelse: "Kjøp av tjenester fra utlandet, 25 %",        type: "inngående", sats: 25, vanlig: false },
  { kode: "88", beskrivelse: "Kjøp av tjenester fra utlandet, 15 %",        type: "inngående", sats: 15, vanlig: false },
  { kode: "89", beskrivelse: "Kjøp av tjenester fra utlandet, 12 %",        type: "inngående", sats: 12, vanlig: false },
  { kode: "91", beskrivelse: "Import av varer, høy sats (25 %)",            type: "inngående", sats: 25, vanlig: false },
  { kode: "92", beskrivelse: "Import av varer, middels sats (15 %)",        type: "inngående", sats: 15, vanlig: false },
];

/** Slå opp MVA-kode på kode-streng */
export function finnMvaKode(kode: string): MvaKode | undefined {
  return MVA_KODER.find((m) => m.kode === kode);
}

/** Alle vanlige MVA-koder (for UI-valglister) */
export const MVA_KODER_VANLIGE = MVA_KODER.filter((m) => m.vanlig);

/**
 * Suggest default SAF-T MVA kode for a given account number.
 * Returns undefined for accounts without VAT relevance.
 */
export function defaultMvaKodeForKonto(kontonr: string): string | undefined {
  const nr = kontonr.padEnd(4, "0");
  const cls = nr[0];
  // Klasse 3: Inntekter med MVA → utgående MVA kode "3" (25 %)
  if (cls === "3") {
    if (["3100", "3210", "3600", "3700", "3900"].some((k) => nr.startsWith(k.slice(0, 4)))) return undefined;
    return "3";
  }
  // Klasse 4, 6, 7: Kostnader med MVA → inngående MVA kode "1" (25 %)
  if (["4", "6", "7"].includes(cls)) return "1";
  // Klasse 5: Lønnskostnader — ingen MVA
  // Klasse 2710: Inngående MVA-kontoer → kode "1"
  if (nr.startsWith("271")) return "1";
  // Klasse 2740: Utgående MVA-kontoer → kode "3"
  if (nr.startsWith("274")) return "3";
  return undefined;
}
