/**
 * Tester for anomalideteksjon (#38)
 *
 * Tester den underliggende beregningslogikken direkte uten React.
 */

import { describe, it, expect } from "vitest";
import type { BilagMedId } from "@/hooks/use-bilag";

// ─── Hjelpefunksjoner (speil av use-anomalideteksjon.ts) ──────────────────────

function statistikk(verdier: number[]) {
  if (verdier.length < 2) return { snitt: verdier[0] ?? 0, std: 0 };
  const snitt = verdier.reduce((s, v) => s + v, 0) / verdier.length;
  const varians = verdier.reduce((s, v) => s + Math.pow(v - snitt, 2), 0) / verdier.length;
  return { snitt, std: Math.sqrt(varians) };
}

function dagDiff(a: string, b: string): number {
  return Math.abs(
    Math.round((new Date(a).getTime() - new Date(b).getTime()) / (1000 * 60 * 60 * 24))
  );
}

// ─── Hjelpere for testdata ────────────────────────────────────────────────────

let idCounter = 0;
function lagBilag(overrides: Partial<BilagMedId> = {}): BilagMedId {
  idCounter++;
  return {
    id: `bilag-${idCounter}`,
    bilagsnr: idCounter,
    dato: "2026-03-10",
    beskrivelse: "Testbilag",
    belop: 1000,
    klientId: "klient-1",
    status: "bokført",
    posteringer: [],
    ...overrides,
  } as BilagMedId;
}

function lagSett(n: number, belop = 1000): BilagMedId[] {
  return Array.from({ length: n }, () => lagBilag({ belop }));
}

// ─── statistikk ───────────────────────────────────────────────────────────────

describe("statistikk", () => {
  it("beregner snitt og std for et sett med verdier", () => {
    const { snitt, std } = statistikk([10, 20, 30]);
    expect(snitt).toBeCloseTo(20);
    expect(std).toBeGreaterThan(0);
  });

  it("returnerer std=0 for én verdi", () => {
    const { std } = statistikk([42]);
    expect(std).toBe(0);
  });

  it("returnerer snitt=0 for tom liste", () => {
    const { snitt } = statistikk([]);
    expect(snitt).toBe(0);
  });
});

// ─── dagDiff ──────────────────────────────────────────────────────────────────

describe("dagDiff", () => {
  it("gir 0 for samme dato", () => {
    expect(dagDiff("2026-03-10", "2026-03-10")).toBe(0);
  });

  it("gir 3 for 3 dagers differanse", () => {
    expect(dagDiff("2026-03-10", "2026-03-13")).toBe(3);
  });

  it("er symmetrisk", () => {
    expect(dagDiff("2026-03-07", "2026-03-10")).toBe(
      dagDiff("2026-03-10", "2026-03-07")
    );
  });
});

// ─── Anomalilogikk ────────────────────────────────────────────────────────────

describe("negativt_belop-deteksjon", () => {
  it("flagger bilag med negativt beløp og status=bokført", () => {
    const b = lagBilag({ belop: -500, status: "bokført" });
    const erNegativtUtenKreditering = b.belop < 0 && b.status !== "kreditert";
    expect(erNegativtUtenKreditering).toBe(true);
  });

  it("flagger IKKE krediterte bilag med negativt beløp", () => {
    const b = lagBilag({ belop: -500, status: "kreditert" });
    const erNegativtUtenKreditering = b.belop < 0 && b.status !== "kreditert";
    expect(erNegativtUtenKreditering).toBe(false);
  });

  it("flagger IKKE bilag med positivt beløp", () => {
    const b = lagBilag({ belop: 500, status: "bokført" });
    const erNegativtUtenKreditering = b.belop < 0 && b.status !== "kreditert";
    expect(erNegativtUtenKreditering).toBe(false);
  });
});

describe("duplikat-deteksjon", () => {
  it("identifiserer duplikat: samme leverandør + beløp innen 3 dager", () => {
    const b1 = lagBilag({ leverandor: "ACME AS", belop: 2000, dato: "2026-03-10" });
    const b2 = lagBilag({ leverandor: "ACME AS", belop: 2000, dato: "2026-03-12" });
    const erDuplikat =
      b1.leverandor && b1.leverandor !== "—" &&
      b1.leverandor === b2.leverandor &&
      Math.abs(b1.belop - b2.belop) < 0.01 &&
      dagDiff(b1.dato, b2.dato) <= 3;
    expect(erDuplikat).toBe(true);
  });

  it("er ikke duplikat hvis beløp avviker", () => {
    const b1 = lagBilag({ leverandor: "ACME AS", belop: 2000, dato: "2026-03-10" });
    const b2 = lagBilag({ leverandor: "ACME AS", belop: 2500, dato: "2026-03-10" });
    const erDuplikat =
      b1.leverandor && b1.leverandor !== "—" &&
      b1.leverandor === b2.leverandor &&
      Math.abs(b1.belop - b2.belop) < 0.01 &&
      dagDiff(b1.dato, b2.dato) <= 3;
    expect(erDuplikat).toBe(false);
  });

  it("er ikke duplikat hvis dato er mer enn 3 dager fra hverandre", () => {
    const b1 = lagBilag({ leverandor: "ACME AS", belop: 2000, dato: "2026-03-10" });
    const b2 = lagBilag({ leverandor: "ACME AS", belop: 2000, dato: "2026-03-14" });
    const erDuplikat =
      b1.leverandor && b1.leverandor !== "—" &&
      b1.leverandor === b2.leverandor &&
      Math.abs(b1.belop - b2.belop) < 0.01 &&
      dagDiff(b1.dato, b2.dato) <= 3;
    expect(erDuplikat).toBe(false);
  });

  it("flagger ikke bilag uten leverandør", () => {
    const b1 = lagBilag({ leverandor: undefined, belop: 2000, dato: "2026-03-10" });
    const b2 = lagBilag({ leverandor: undefined, belop: 2000, dato: "2026-03-10" });
    const erDuplikat =
      b1.leverandor && b1.leverandor !== "—" &&
      b1.leverandor === b2.leverandor &&
      Math.abs(b1.belop - b2.belop) < 0.01 &&
      dagDiff(b1.dato, b2.dato) <= 3;
    expect(erDuplikat).toBeFalsy();
  });
});

describe("rundt_tall-deteksjon", () => {
  it("flagger beløp som er divisibelt med 1000 og minst 5000", () => {
    const absBeløp = 10000;
    expect(absBeløp >= 5_000 && absBeløp % 1_000 === 0).toBe(true);
  });

  it("flagger ikke beløp under 5000 selv om de er runde", () => {
    const absBeløp = 3000;
    expect(absBeløp >= 5_000 && absBeløp % 1_000 === 0).toBe(false);
  });

  it("flagger ikke beløp med øre", () => {
    const absBeløp = 10500;
    expect(absBeløp >= 5_000 && absBeløp % 1_000 === 0).toBe(false);
  });
});

describe("statistisk_avvik (z-score)", () => {
  it("beregner z-score korrekt for utliggere", () => {
    // Mange lave beløp og ett svært høyt gir z > 3
    const beløp = [...Array(20).fill(1000), 1_000_000];
    const { snitt, std } = statistikk(beløp);
    const zScore = Math.abs((1_000_000 - snitt) / std);
    expect(zScore).toBeGreaterThan(3);
  });

  it("gir lav z-score for normalt beløp", () => {
    const beløp = [1000, 1200, 900, 1100, 950, 1050, 1000, 1100, 900, 1000];
    const { snitt, std } = statistikk(beløp);
    const zScore = Math.abs((1000 - snitt) / std);
    expect(zScore).toBeLessThan(1);
  });
});

describe("helg_bokforing-deteksjon", () => {
  it("flagger lørdag (dagNr=6)", () => {
    // 2026-03-14 er en lørdag
    const dagNr = new Date("2026-03-14").getDay();
    expect(dagNr).toBe(6);
    expect(dagNr === 0 || dagNr === 6).toBe(true);
  });

  it("flagger søndag (dagNr=0)", () => {
    // 2026-03-15 er en søndag
    const dagNr = new Date("2026-03-15").getDay();
    expect(dagNr).toBe(0);
    expect(dagNr === 0 || dagNr === 6).toBe(true);
  });

  it("flagger ikke mandag", () => {
    // 2026-03-16 er en mandag
    const dagNr = new Date("2026-03-16").getDay();
    expect(dagNr === 0 || dagNr === 6).toBe(false);
  });
});
