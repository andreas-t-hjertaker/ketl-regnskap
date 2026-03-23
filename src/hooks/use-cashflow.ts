"use client";

/**
 * Cashflow-prognose — prediktiv analyse av likviditet (#39)
 *
 * Beregner historisk cashflow fra bilag og projiserer fremtidig likviditet.
 * Bruker et enkelt glidende gjennomsnitt for prognose.
 */

import { useMemo } from "react";
import type { BilagMedId } from "@/hooks/use-bilag";

export type CashflowMåned = {
  periode: string;     // "2026-01"
  label: string;       // "jan 2026"
  innbetalinger: number;
  utbetalinger: number;
  netto: number;
  akkumulert: number;
  erPrognose: boolean;
};

const månedNavn = [
  "jan", "feb", "mar", "apr", "mai", "jun",
  "jul", "aug", "sep", "okt", "nov", "des",
];

/** Generer alle måneder mellom to datoer (inklusiv) */
function genererMåneder(fra: string, til: string): string[] {
  const result: string[] = [];
  const [startÅr, startMnd] = fra.split("-").map(Number);
  const [sluttÅr, sluttMnd] = til.split("-").map(Number);
  let år = startÅr;
  let mnd = startMnd;
  while (år < sluttÅr || (år === sluttÅr && mnd <= sluttMnd)) {
    result.push(`${år}-${String(mnd).padStart(2, "0")}`);
    mnd++;
    if (mnd > 12) { mnd = 1; år++; }
  }
  return result;
}

/** Beregner glidende gjennomsnitt over de siste N verdiene */
function glidendeGjennomsnitt(verdier: number[], n: number): number {
  if (verdier.length === 0) return 0;
  const slice = verdier.slice(-n);
  return slice.reduce((s, v) => s + v, 0) / slice.length;
}

export function useCashflow(bilag: BilagMedId[], prognoseMåneder: number = 6) {
  return useMemo(() => {
    // Kun bokførte/krediterte bilag
    const bokførte = bilag.filter(
      (b) => b.status === "bokført" || b.status === "kreditert"
    );

    if (bokførte.length === 0) {
      return { måneder: [], totalInn: 0, totalUt: 0, snittNetto: 0 };
    }

    // Grupper inn-/utbetalinger per måned
    const innMap = new Map<string, number>();
    const utMap = new Map<string, number>();

    for (const b of bokførte) {
      const periode = b.dato.slice(0, 7);
      for (const p of b.posteringer) {
        const klasse = p.kontonr[0];
        if (klasse === "3") {
          // Inntekter (kredit-side)
          innMap.set(periode, (innMap.get(periode) ?? 0) + (p.kredit - p.debet));
        } else if (klasse >= "4" && klasse <= "8") {
          // Kostnader (debet-side)
          utMap.set(periode, (utMap.get(periode) ?? 0) + (p.debet - p.kredit));
        }
      }
    }

    // Finn tidsrom
    const allePerioder = [...new Set([...innMap.keys(), ...utMap.keys()])].sort();
    if (allePerioder.length === 0) {
      return { måneder: [], totalInn: 0, totalUt: 0, snittNetto: 0 };
    }

    const førstePeriode = allePerioder[0];
    const sistePeriode = allePerioder[allePerioder.length - 1];

    // Historiske måneder
    const historiskeMåneder = genererMåneder(førstePeriode, sistePeriode);
    const historiske: CashflowMåned[] = [];
    let akkumulert = 0;
    const nettoVerdier: number[] = [];

    for (const p of historiskeMåneder) {
      const inn = Math.abs(innMap.get(p) ?? 0);
      const ut = Math.abs(utMap.get(p) ?? 0);
      const netto = inn - ut;
      akkumulert += netto;
      nettoVerdier.push(netto);
      const [å, m] = p.split("-").map(Number);
      historiske.push({
        periode: p,
        label: `${månedNavn[m - 1]} ${å}`,
        innbetalinger: inn,
        utbetalinger: ut,
        netto,
        akkumulert,
        erPrognose: false,
      });
    }

    // Prognose: glidende gjennomsnitt over siste 3 måneder
    const snittInn = glidendeGjennomsnitt(
      historiske.map((h) => h.innbetalinger),
      3
    );
    const snittUt = glidendeGjennomsnitt(
      historiske.map((h) => h.utbetalinger),
      3
    );

    // Generer prognosemåneder
    const [sisteÅr, sisteMnd] = sistePeriode.split("-").map(Number);
    let pÅr = sisteÅr;
    let pMnd = sisteMnd + 1;
    if (pMnd > 12) { pMnd = 1; pÅr++; }
    const sluttPeriode = `${pÅr + Math.floor((pMnd + prognoseMåneder - 2) / 12)}-${String(
      ((pMnd + prognoseMåneder - 2) % 12) + 1
    ).padStart(2, "0")}`;

    const prognoseMnd = genererMåneder(
      `${pÅr}-${String(pMnd).padStart(2, "0")}`,
      sluttPeriode
    );

    const prognoser: CashflowMåned[] = [];
    for (const p of prognoseMnd) {
      const netto = snittInn - snittUt;
      akkumulert += netto;
      const [å, m] = p.split("-").map(Number);
      prognoser.push({
        periode: p,
        label: `${månedNavn[m - 1]} ${å}`,
        innbetalinger: snittInn,
        utbetalinger: snittUt,
        netto,
        akkumulert,
        erPrognose: true,
      });
    }

    const totalInn = historiske.reduce((s, h) => s + h.innbetalinger, 0);
    const totalUt = historiske.reduce((s, h) => s + h.utbetalinger, 0);
    const snittNetto =
      nettoVerdier.length > 0
        ? nettoVerdier.reduce((s, v) => s + v, 0) / nettoVerdier.length
        : 0;

    return {
      måneder: [...historiske, ...prognoser],
      totalInn,
      totalUt,
      snittNetto,
    };
  }, [bilag, prognoseMåneder]);
}
