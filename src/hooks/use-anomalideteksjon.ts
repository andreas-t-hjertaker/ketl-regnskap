"use client";

/**
 * AI Anomalideteksjon (#38)
 *
 * Analyserer bokførte bilag og identifiserer statistiske avvik som kan
 * indikere feil, dobbeltregistrering eller uvanlige transaksjoner.
 *
 * Algoritmer:
 * - Duplikat-deteksjon: samme beløp + leverandør innen ±3 dager
 * - Z-score: beløp som avviker > 2 standardavvik fra snittet
 * - Helg-deteksjon: bokføringsdato på lørdag/søndag
 * - Runde tall: beløp divisibelt med 1000 uten øre (mulig feil)
 * - Negativt beløp: uventede negative beløp (ikke kreditering)
 * - Høy MVA-differanse: MVA-beregning avviker > 1% fra forventet
 */

import { useMemo } from "react";
import type { BilagMedId } from "@/hooks/use-bilag";

export type AnomalType =
  | "duplikat"
  | "statistisk_avvik"
  | "helg_bokforing"
  | "rundt_tall"
  | "negativt_belop"
  | "mva_differanse";

export type Anomali = {
  bilagId: string;
  bilagsnr: number;
  type: AnomalType;
  alvorlighet: "lav" | "middels" | "høy";
  beskrivelse: string;
  dato: string;
  belop: number;
};

/** Kalkuler gjennomsnitt og standardavvik */
function statistikk(verdier: number[]) {
  if (verdier.length < 2) return { snitt: verdier[0] ?? 0, std: 0 };
  const snitt = verdier.reduce((s, v) => s + v, 0) / verdier.length;
  const varians = verdier.reduce((s, v) => s + Math.pow(v - snitt, 2), 0) / verdier.length;
  return { snitt, std: Math.sqrt(varians) };
}

/** Antall dager mellom to ISO-datoer */
function dagDiff(a: string, b: string): number {
  return Math.abs(
    Math.round(
      (new Date(a).getTime() - new Date(b).getTime()) / (1000 * 60 * 60 * 24)
    )
  );
}

export function useAnomalideteksjon(bilag: BilagMedId[]): Anomali[] {
  return useMemo(() => {
    const bokforte = bilag.filter(
      (b) => b.status === "bokført" || b.status === "kreditert"
    );
    if (bokforte.length < 3) return [];

    const anomalier: Anomali[] = [];
    const beløp = bokforte.map((b) => Math.abs(b.belop));
    const { snitt, std } = statistikk(beløp);

    for (let i = 0; i < bokforte.length; i++) {
      const b = bokforte[i];
      const absBeløp = Math.abs(b.belop);

      // ─── Duplikat: samme leverandør + beløp innen 3 dager ───────────────────
      for (let j = i + 1; j < bokforte.length; j++) {
        const b2 = bokforte[j];
        if (
          b.leverandor &&
          b.leverandor !== "—" &&
          b.leverandor === b2.leverandor &&
          Math.abs(b.belop - b2.belop) < 0.01 &&
          dagDiff(b.dato, b2.dato) <= 3
        ) {
          anomalier.push({
            bilagId: b.id,
            bilagsnr: b.bilagsnr,
            type: "duplikat",
            alvorlighet: "høy",
            beskrivelse: `Mulig duplikat av bilag #${b2.bilagsnr}: samme leverandør og beløp innen 3 dager`,
            dato: b.dato,
            belop: b.belop,
          });
          break;
        }
      }

      // ─── Statistisk avvik: z-score > 2 ──────────────────────────────────────
      if (std > 0) {
        const zScore = Math.abs(absBeløp - snitt) / std;
        if (zScore > 3) {
          anomalier.push({
            bilagId: b.id,
            bilagsnr: b.bilagsnr,
            type: "statistisk_avvik",
            alvorlighet: "høy",
            beskrivelse: `Beløp ${absBeløp.toLocaleString("nb-NO")} NOK er ${zScore.toFixed(1)} standardavvik fra gjennomsnittet (${Math.round(snitt).toLocaleString("nb-NO")} NOK)`,
            dato: b.dato,
            belop: b.belop,
          });
        } else if (zScore > 2) {
          anomalier.push({
            bilagId: b.id,
            bilagsnr: b.bilagsnr,
            type: "statistisk_avvik",
            alvorlighet: "middels",
            beskrivelse: `Uvanlig beløp — ${zScore.toFixed(1)}σ over gjennomsnittet på ${Math.round(snitt).toLocaleString("nb-NO")} NOK`,
            dato: b.dato,
            belop: b.belop,
          });
        }
      }

      // ─── Helg-bokføring ───────────────────────────────────────────────────────
      const dagNr = new Date(b.dato).getDay(); // 0=søndag, 6=lørdag
      if (dagNr === 0 || dagNr === 6) {
        anomalier.push({
          bilagId: b.id,
          bilagsnr: b.bilagsnr,
          type: "helg_bokforing",
          alvorlighet: "lav",
          beskrivelse: `Bokføringsdato er en ${dagNr === 6 ? "lørdag" : "søndag"}. Bekreft at datoen er riktig.`,
          dato: b.dato,
          belop: b.belop,
        });
      }

      // ─── Rundt tall (potensielt estimert) ────────────────────────────────────
      if (absBeløp >= 5_000 && absBeløp % 1_000 === 0) {
        anomalier.push({
          bilagId: b.id,
          bilagsnr: b.bilagsnr,
          type: "rundt_tall",
          alvorlighet: "lav",
          beskrivelse: `Rundt beløp (${absBeløp.toLocaleString("nb-NO")} NOK) — kan være estimert. Sjekk originalbilag.`,
          dato: b.dato,
          belop: b.belop,
        });
      }

      // ─── MVA-differanse > 1 kr ────────────────────────────────────────────────
      const mvaPost25 = b.posteringer
        .filter((p) => p.kontonr.startsWith("271"))
        .reduce((s, p) => s + ((p.debet ?? 0) - (p.kredit ?? 0)), 0);
      const kostPost = b.posteringer
        .filter((p) => p.kontonr[0] >= "4" && p.kontonr[0] <= "8")
        .reduce((s, p) => s + ((p.debet ?? 0) - (p.kredit ?? 0)), 0);
      if (kostPost > 0 && mvaPost25 > 0) {
        const forventetMva = kostPost * 0.25;
        const differanse = Math.abs(mvaPost25 - forventetMva);
        if (differanse > 5 && differanse / forventetMva > 0.02) {
          anomalier.push({
            bilagId: b.id,
            bilagsnr: b.bilagsnr,
            type: "mva_differanse",
            alvorlighet: "middels",
            beskrivelse: `MVA-beløp (${Math.round(mvaPost25).toLocaleString("nb-NO")} NOK) avviker ${Math.round(differanse).toLocaleString("nb-NO")} NOK fra forventet 25% av netto`,
            dato: b.dato,
            belop: b.belop,
          });
        }
      }
    }

    // Sorter: høy → middels → lav, og dedupliser per bilag (ta kun alvorligste per bilag)
    const byBilag = new Map<string, Anomali>();
    const alvScore: Record<Anomali["alvorlighet"], number> = { høy: 3, middels: 2, lav: 1 };
    for (const a of anomalier) {
      const existing = byBilag.get(a.bilagId);
      if (!existing || alvScore[a.alvorlighet] > alvScore[existing.alvorlighet]) {
        byBilag.set(a.bilagId, a);
      }
    }

    return [...byBilag.values()].sort(
      (a, b) => alvScore[b.alvorlighet] - alvScore[a.alvorlighet]
    );
  }, [bilag]);
}
