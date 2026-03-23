"use client";

import { useMemo, useCallback } from "react";
import { useBilag } from "@/hooks/use-bilag";
import type { Postering } from "@/types";

/** Alle posteringer fra bokførte og krediterte bilag (begge inngår i regnskapet) */
function hentPosteringer(bilag: ReturnType<typeof useBilag>["bilag"]) {
  return bilag
    .filter((b) => b.status === "bokført" || b.status === "kreditert")
    .flatMap((b) => b.posteringer.map((p) => ({ ...p, dato: b.dato, bilagId: b.id })));
}

/** Kontoklasse fra kontonummer */
function kontoKlasse(kontonr: string): "inntekt" | "kostnad" | "eiendel" | "gjeld" | "annet" {
  const c = kontonr[0];
  if (c === "3") return "inntekt";
  if (c >= "4" && c <= "8") return "kostnad";
  if (c === "1") return "eiendel";
  if (c === "2") return "gjeld";
  return "annet";
}

type ResultatLinje = { konto: string; navn: string; belop: number };

export type Resultatregnskap = {
  driftsinntekter: ResultatLinje[];
  driftskostnader: ResultatLinje[];
  totalInntekter: number;
  totalKostnader: number;
  resultat: number;
};

export type BalanseLinje = { konto: string; navn: string; belop: number };

export type Balanse = {
  eiendeler: BalanseLinje[];
  gjeldOgEgenkapital: BalanseLinje[];
  totalEiendeler: number;
  totalGjeld: number;
};

export type MvaTerm = {
  periode: string;
  utgåendeMva: number;
  inngåendeMva: number;
  åBetale: number;
};

// ─── Kontantstrømoppstilling (#124) ──────────────────────────────────────────

export type KontantstrømLinje = {
  label: string;
  belop: number;
  /** Er denne linjen en delsum/total? */
  erTotal?: boolean;
};

export type Kontantstrøm = {
  operasjonell: KontantstrømLinje[];
  nettoDrift: number;
  investering: KontantstrømLinje[];
  nettoInvestering: number;
  finansiering: KontantstrømLinje[];
  nettoFinansiering: number;
  nettoEndring: number;
};

function grupperEtterKonto(poster: (Postering & { dato: string })[]) {
  const map = new Map<string, { kontonavn: string; netto: number }>();
  for (const p of poster) {
    const existing = map.get(p.kontonr);
    const netto = (p.debet ?? 0) - (p.kredit ?? 0);
    if (existing) {
      existing.netto += netto;
    } else {
      map.set(p.kontonr, { kontonavn: p.kontonavn, netto });
    }
  }
  return map;
}

export function useRapporter(uid: string | null, klientId?: string | null) {
  const { bilag, loading } = useBilag(uid, klientId);

  const posteringer = useMemo(() => hentPosteringer(bilag), [bilag]);

  const resultatForPeriode = useCallback((periode: string): Resultatregnskap => {
    const filtrert = periode === "alt"
      ? posteringer
      : posteringer.filter((p) => p.dato.startsWith(periode));

    const gruppert = grupperEtterKonto(filtrert);

    const driftsinntekter: ResultatLinje[] = [];
    const driftskostnader: ResultatLinje[] = [];

    for (const [konto, { kontonavn, netto }] of gruppert.entries()) {
      const klasse = kontoKlasse(konto);
      if (klasse === "inntekt" && netto !== 0) {
        driftsinntekter.push({ konto, navn: kontonavn, belop: Math.abs(netto) });
      } else if (klasse === "kostnad" && netto !== 0) {
        driftskostnader.push({ konto, navn: kontonavn, belop: Math.abs(netto) });
      }
    }

    driftsinntekter.sort((a, b) => a.konto.localeCompare(b.konto));
    driftskostnader.sort((a, b) => a.konto.localeCompare(b.konto));

    const totalInntekter = driftsinntekter.reduce((s, r) => s + r.belop, 0);
    const totalKostnader = driftskostnader.reduce((s, r) => s + r.belop, 0);

    return {
      driftsinntekter,
      driftskostnader,
      totalInntekter,
      totalKostnader,
      resultat: totalInntekter - totalKostnader,
    };
  }, [posteringer]);

  const balanse = useMemo((): Balanse => {
    const gruppert = grupperEtterKonto(posteringer);

    const eiendeler: BalanseLinje[] = [];
    const gjeldOgEgenkapital: BalanseLinje[] = [];

    for (const [konto, { kontonavn, netto }] of gruppert.entries()) {
      const klasse = kontoKlasse(konto);
      if (klasse === "eiendel" && netto !== 0) {
        eiendeler.push({ konto, navn: kontonavn, belop: Math.abs(netto) });
      } else if ((klasse === "gjeld" || konto[0] === "2") && netto !== 0) {
        gjeldOgEgenkapital.push({ konto, navn: kontonavn, belop: Math.abs(netto) });
      }
    }

    eiendeler.sort((a, b) => a.konto.localeCompare(b.konto));
    gjeldOgEgenkapital.sort((a, b) => a.konto.localeCompare(b.konto));

    return {
      eiendeler,
      gjeldOgEgenkapital,
      totalEiendeler: eiendeler.reduce((s, r) => s + r.belop, 0),
      totalGjeld: gjeldOgEgenkapital.reduce((s, r) => s + r.belop, 0),
    };
  }, [posteringer]);

  const mvaTerminer = useMemo((): MvaTerm[] => {
    // Grupper etter 2-månedlige terminer
    const terminMap = new Map<string, { utgående: number; inngående: number }>();

    for (const p of posteringer) {
      if (!p.dato || !p.dato.includes("-")) continue;
      const [år, mnd] = p.dato.split("-").map(Number);
      if (!år || !mnd) continue;
      const terminNr = Math.ceil(mnd / 2);
      const terminKey = `${år}-T${terminNr}`;

      if (!terminMap.has(terminKey)) {
        terminMap.set(terminKey, { utgående: 0, inngående: 0 });
      }
      const termin = terminMap.get(terminKey)!;

      // Utgående MVA: kontoer 274x — netto kredit (kredit − debet) for å håndtere korrigeringer
      if (p.kontonr.startsWith("274")) {
        termin.utgående += (p.kredit ?? 0) - (p.debet ?? 0);
      }
      // Inngående MVA: kontoer 271x — netto debet (debet − kredit) for å håndtere korrigeringer
      if (p.kontonr.startsWith("271")) {
        termin.inngående += (p.debet ?? 0) - (p.kredit ?? 0);
      }
    }

    // Bygg array med labels
    const terminer: MvaTerm[] = [];
    for (const [key, v] of terminMap.entries()) {
      const [år, terminPart] = key.split("-T");
      const terminNr = parseInt(terminPart, 10);
      const måneder = ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"];
      const startMnd = (terminNr - 1) * 2;
      const label = `Termin ${terminNr} (${måneder[startMnd]}–${måneder[startMnd + 1]}) ${år}`;
      terminer.push({
        periode: label,
        utgåendeMva: v.utgående,
        inngåendeMva: v.inngående,
        åBetale: v.utgående - v.inngående,
      });
    }

    return terminer.sort((a, b) => a.periode.localeCompare(b.periode));
  }, [posteringer]);

  /**
   * Kontantstrømoppstilling — indirekte metode (Rskl. § 6-4).
   *
   * A. Operasjonelle aktiviteter:
   *    Driftsresultat + avskrivninger + endringer i arbeidskapital
   * B. Investeringsaktiviteter:
   *    Netto bevegelse på anleggsmiddelkontoer (10xx–12xx)
   * C. Finansieringsaktiviteter:
   *    Netto bevegelse på lån og egenkapitalkontoer (20xx–23xx)
   */
  const kontantstrømForPeriode = useCallback((periode: string): Kontantstrøm => {
    const filtrert = periode === "alt"
      ? posteringer
      : posteringer.filter((p) => p.dato?.startsWith(periode));

    const gruppert = grupperEtterKonto(filtrert);

    // Hjelpefunksjon: sum netto for kontoer som starter med et av prefixene
    function sumPrefixer(prefixer: string[]): number {
      let sum = 0;
      for (const [kontonr, { netto }] of gruppert.entries()) {
        if (prefixer.some((pre) => kontonr.startsWith(pre))) {
          sum += netto;
        }
      }
      return sum;
    }

    // ── A. Operasjonelle aktiviteter ──────────────────────────────────────
    const resultat = resultatForPeriode(periode);
    const driftsresultat = resultat.resultat;

    // Avskrivninger (konto 60xx, 61xx) — non-cash kostnad, legges tilbake
    const avskrivninger = sumPrefixer(["60", "61"]);

    // Endring i kundefordringer (15xx): netto debet = økning = neg cashflow
    const endringFordringer = -(sumPrefixer(["15", "13"]));

    // Endring i leverandørgjeld (24xx): netto kredit = økning = pos cashflow
    const endringLevgjeld = -(sumPrefixer(["24"]));

    // Endring i annen arbeidskapital (14xx, 16xx, 17xx, 25xx, 26xx, 29xx)
    const endringArbeidskapital = -(sumPrefixer(["14", "16", "17", "25", "26", "29"]));

    const nettoDrift =
      driftsresultat + avskrivninger + endringFordringer + endringLevgjeld + endringArbeidskapital;

    const operasjonell: KontantstrømLinje[] = [
      { label: "Driftsresultat", belop: driftsresultat },
      { label: "Avskrivninger og nedskrivninger (+)", belop: avskrivninger },
      { label: "Endring i kundefordringer", belop: endringFordringer },
      { label: "Endring i leverandørgjeld", belop: endringLevgjeld },
      { label: "Endring i annen arbeidskapital", belop: endringArbeidskapital },
      { label: "Netto kontantstrøm fra driften", belop: nettoDrift, erTotal: true },
    ];

    // ── B. Investeringsaktiviteter ───────────────────────────────────────
    // Anleggsmidler (10xx–12xx): netto debet = kjøp = neg cashflow
    const kjøpAnlegg = -(sumPrefixer(["10", "11", "12"]));

    const nettoInvestering = kjøpAnlegg;

    const investering: KontantstrømLinje[] = [
      { label: "Netto investering i anleggsmidler", belop: kjøpAnlegg },
      { label: "Netto kontantstrøm fra investeringer", belop: nettoInvestering, erTotal: true },
    ];

    // ── C. Finansieringsaktiviteter ──────────────────────────────────────
    // Gjeld (20xx–23xx): netto kredit = nytt lån = pos cashflow
    const endringLån = -(sumPrefixer(["20", "21", "22", "23"]));

    const nettoFinansiering = endringLån;

    const finansiering: KontantstrømLinje[] = [
      { label: "Endring i lån og egenkapital", belop: endringLån },
      { label: "Netto kontantstrøm fra finansiering", belop: nettoFinansiering, erTotal: true },
    ];

    const nettoEndring = nettoDrift + nettoInvestering + nettoFinansiering;

    return {
      operasjonell,
      nettoDrift,
      investering,
      nettoInvestering,
      finansiering,
      nettoFinansiering,
      nettoEndring,
    };
  }, [posteringer, resultatForPeriode]);

  return {
    loading,
    bilag,
    posteringer,
    resultatForPeriode,
    kontantstrømForPeriode,
    balanse,
    mvaTerminer,
  };
}
