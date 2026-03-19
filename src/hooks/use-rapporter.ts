"use client";

import { useMemo } from "react";
import { useBilag } from "@/hooks/use-bilag";
import type { Postering } from "@/types";

/** Alle posteringer fra bokførte bilag */
function hentPosteringer(bilag: ReturnType<typeof useBilag>["bilag"]) {
  return bilag
    .filter((b) => b.status === "bokført")
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

  const resultatregnskap = useMemo(
    (periode?: string): Resultatregnskap => {
      const filtrert = periode
        ? posteringer.filter((p) => p.dato.startsWith(periode))
        : posteringer;

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
    },
    [posteringer]
  );

  function resultatForPeriode(periode: string): Resultatregnskap {
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
  }

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
      const [år, mnd] = p.dato.split("-").map(Number);
      const terminNr = Math.ceil(mnd / 2);
      const terminKey = `${år}-T${terminNr}`;
      const label = (() => {
        const måneder = ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"];
        const startMnd = (terminNr - 1) * 2;
        return `Termin ${terminNr} (${måneder[startMnd]}–${måneder[startMnd + 1]}) ${år}`;
      })();

      if (!terminMap.has(terminKey)) {
        terminMap.set(terminKey, { utgående: 0, inngående: 0 });
      }
      const termin = terminMap.get(terminKey)!;

      // Utgående MVA: kontoer 274x
      if (p.kontonr.startsWith("274")) {
        termin.utgående += p.kredit ?? 0;
      }
      // Inngående MVA: kontoer 271x
      if (p.kontonr.startsWith("271")) {
        termin.inngående += p.debet ?? 0;
      }
      // Attach label to key
      terminMap.set(terminKey, { ...termin, ...(terminMap.get(terminKey) ?? {}) });

      void label; // bruk label for å unngå lint-advarsel
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

  return {
    loading,
    bilag,
    posteringer,
    resultatregnskap,
    resultatForPeriode,
    balanse,
    mvaTerminer,
  };
}
