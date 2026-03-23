"use client";

/**
 * Reskontro — åpne poster og aldersfordeling
 *
 * Kundefordringer (konto 1500): bilag knyttet til kunder
 * Leverandørgjeld (konto 2400): bilag knyttet til leverandører
 *
 * Aldersfordeling (aging):
 *   0–30 dager  — ikke forfalt (current)
 *   31–60 dager — litt gammel
 *   61–90 dager — forsinket
 *   91+ dager   — langt forfalt
 */

import { useMemo } from "react";
import type { BilagMedId } from "@/hooks/use-bilag";
import type { MotpartMedId } from "@/hooks/use-motparter";

export type AldersBøtte = "0-30" | "31-60" | "61-90" | "91+";

export type ÅpenPost = {
  bilagId: string;
  bilagsnr: number;
  dato: string;          // ISO date
  beskrivelse: string;
  belop: number;
  dagerGammel: number;
  aldersBøtte: AldersBøtte;
};

export type ReskontroPoster = {
  motpartId: string;
  motpartNavn: string;
  orgnr?: string;
  åpnePoster: ÅpenPost[];
  totalBelop: number;
  /** Beløp fordelt på aldersgrupper */
  aldersfordeling: Record<AldersBøtte, number>;
};

export type ReskontroData = {
  kundefordringer: ReskontroPoster[];
  leverandørgjeld: ReskontroPoster[];
  /** Bilag uten tilknyttet motpart, men med kundefordringskonto (1500) */
  ufiltrerteKundebilag: ÅpenPost[];
  /** Bilag uten tilknyttet motpart, men med leverandørgjeldskonto (2400) */
  ufiltrerteLevebilag: ÅpenPost[];
  totalKundefordringer: number;
  totalLeverandørgjeld: number;
};

function dagerGammel(dato: string): number {
  const bilagDato = new Date(dato);
  const nå = new Date();
  return Math.floor((nå.getTime() - bilagDato.getTime()) / 86_400_000);
}

function aldersBøtte(dager: number): AldersBøtte {
  if (dager <= 30) return "0-30";
  if (dager <= 60) return "31-60";
  if (dager <= 90) return "61-90";
  return "91+";
}

function tomAldersfordeling(): Record<AldersBøtte, number> {
  return { "0-30": 0, "31-60": 0, "61-90": 0, "91+": 0 };
}

export function useReskontro(
  bilag: BilagMedId[],
  motparter: MotpartMedId[]
): ReskontroData {
  return useMemo(() => {
    // Kun bokførte bilag inngår i reskontro
    const bokførteBilag = bilag.filter(
      (b) => b.status === "bokført" || b.status === "kreditert"
    );

    const kundeMap = new Map<string, MotpartMedId>(
      motparter.filter((m) => m.type === "kunde").map((m) => [m.id, m])
    );
    const leverandorMap = new Map<string, MotpartMedId>(
      motparter.filter((m) => m.type === "leverandor").map((m) => [m.id, m])
    );

    // Bygg reskontro per motpart
    const kundeReskontro = new Map<string, ReskontroPoster>();
    const leverandorReskontro = new Map<string, ReskontroPoster>();
    const ufiltrerteKundebilag: ÅpenPost[] = [];
    const ufiltrerteLevebilag: ÅpenPost[] = [];

    for (const b of bokførteBilag) {
      // Sjekk om bilaget har kontoer som indikerer kundefordring eller leverandørgjeld
      const harKundefordring = b.posteringer.some(
        (p) => p.kontonr.startsWith("1500") || p.kontonr === "1500"
      );
      const harLeverandørgjeld = b.posteringer.some(
        (p) => p.kontonr.startsWith("2400") || p.kontonr === "2400"
      );

      if (!harKundefordring && !harLeverandørgjeld) continue;

      const dager = dagerGammel(b.dato);
      const post: ÅpenPost = {
        bilagId: b.id,
        bilagsnr: b.bilagsnr,
        dato: b.dato,
        beskrivelse: b.beskrivelse,
        belop: b.belop,
        dagerGammel: dager,
        aldersBøtte: aldersBøtte(dager),
      };

      if (harKundefordring) {
        if (b.motpartId && kundeMap.has(b.motpartId)) {
          const motpart = kundeMap.get(b.motpartId)!;
          if (!kundeReskontro.has(b.motpartId)) {
            kundeReskontro.set(b.motpartId, {
              motpartId: b.motpartId,
              motpartNavn: motpart.navn,
              orgnr: motpart.orgnr,
              åpnePoster: [],
              totalBelop: 0,
              aldersfordeling: tomAldersfordeling(),
            });
          }
          const r = kundeReskontro.get(b.motpartId)!;
          r.åpnePoster.push(post);
          r.totalBelop += b.belop;
          r.aldersfordeling[post.aldersBøtte] += b.belop;
        } else {
          ufiltrerteKundebilag.push(post);
        }
      }

      if (harLeverandørgjeld) {
        if (b.motpartId && leverandorMap.has(b.motpartId)) {
          const motpart = leverandorMap.get(b.motpartId)!;
          if (!leverandorReskontro.has(b.motpartId)) {
            leverandorReskontro.set(b.motpartId, {
              motpartId: b.motpartId,
              motpartNavn: motpart.navn,
              orgnr: motpart.orgnr,
              åpnePoster: [],
              totalBelop: 0,
              aldersfordeling: tomAldersfordeling(),
            });
          }
          const r = leverandorReskontro.get(b.motpartId)!;
          r.åpnePoster.push(post);
          r.totalBelop += b.belop;
          r.aldersfordeling[post.aldersBøtte] += b.belop;
        } else {
          ufiltrerteLevebilag.push(post);
        }
      }
    }

    const kundefordringer = [...kundeReskontro.values()].sort(
      (a, b) => b.totalBelop - a.totalBelop
    );
    const leverandørgjeld = [...leverandorReskontro.values()].sort(
      (a, b) => b.totalBelop - a.totalBelop
    );

    const totalKundefordringer =
      kundefordringer.reduce((s, r) => s + r.totalBelop, 0) +
      ufiltrerteKundebilag.reduce((s, p) => s + p.belop, 0);

    const totalLeverandørgjeld =
      leverandørgjeld.reduce((s, r) => s + r.totalBelop, 0) +
      ufiltrerteLevebilag.reduce((s, p) => s + p.belop, 0);

    return {
      kundefordringer,
      leverandørgjeld,
      ufiltrerteKundebilag,
      ufiltrerteLevebilag,
      totalKundefordringer,
      totalLeverandørgjeld,
    };
  }, [bilag, motparter]);
}
