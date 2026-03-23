/**
 * Tester for faktura-beregninger
 *
 * beregnFakturaSummer er en ren funksjon — enkelt å enhetsteste.
 * Tester MVA-beregning for ulike satser, rabatter og kombinasjoner.
 */

import { describe, it, expect } from "vitest";
import { beregnFakturaSummer } from "@/hooks/use-faktura";
import type { FakturaLinje } from "@/types";

// ─── Hjelpere ────────────────────────────────────────────────────────────────

function lagLinje(overrides: Partial<FakturaLinje> = {}): FakturaLinje {
  return {
    beskrivelse: "Konsulenttime",
    antall: 1,
    enhetspris: 1000,
    mvaKode: "25",
    mvaSats: 25,
    ...overrides,
  };
}

// ─── beregnFakturaSummer ──────────────────────────────────────────────────────

describe("beregnFakturaSummer", () => {
  it("beregner korrekt for en linje med 25% MVA", () => {
    const linjer = [lagLinje({ antall: 1, enhetspris: 1000, mvaSats: 25 })];
    const { sumEksMva, sumMva, sumInkMva } = beregnFakturaSummer(linjer);
    expect(sumEksMva).toBe(1000);
    expect(sumMva).toBe(250);
    expect(sumInkMva).toBe(1250);
  });

  it("beregner korrekt for 15% MVA (matvarer)", () => {
    const linjer = [lagLinje({ antall: 2, enhetspris: 500, mvaSats: 15 })];
    const { sumEksMva, sumMva, sumInkMva } = beregnFakturaSummer(linjer);
    expect(sumEksMva).toBe(1000);
    expect(sumMva).toBe(150);
    expect(sumInkMva).toBe(1150);
  });

  it("beregner korrekt for 0% MVA", () => {
    const linjer = [lagLinje({ antall: 1, enhetspris: 2000, mvaSats: 0 })];
    const { sumEksMva, sumMva, sumInkMva } = beregnFakturaSummer(linjer);
    expect(sumEksMva).toBe(2000);
    expect(sumMva).toBe(0);
    expect(sumInkMva).toBe(2000);
  });

  it("trekker fra rabatt før MVA-beregning", () => {
    // 1000 kr med 10% rabatt = 900 kr. MVA 25% av 900 = 225. Total = 1125.
    const linjer = [lagLinje({ antall: 1, enhetspris: 1000, mvaSats: 25, rabatt: 10 })];
    const { sumEksMva, sumMva, sumInkMva } = beregnFakturaSummer(linjer);
    expect(sumEksMva).toBe(900);
    expect(sumMva).toBe(225);
    expect(sumInkMva).toBe(1125);
  });

  it("summerer korrekt over flere linjer med ulike satser", () => {
    const linjer = [
      lagLinje({ antall: 1, enhetspris: 1000, mvaSats: 25 }), // 1000 + 250
      lagLinje({ antall: 1, enhetspris: 500, mvaSats: 15 }),  // 500 + 75
      lagLinje({ antall: 1, enhetspris: 200, mvaSats: 0 }),   // 200 + 0
    ];
    const { sumEksMva, sumMva, sumInkMva } = beregnFakturaSummer(linjer);
    expect(sumEksMva).toBe(1700);
    expect(sumMva).toBe(325);
    expect(sumInkMva).toBe(2025);
  });

  it("returnerer 0 for tom linjeliste", () => {
    const { sumEksMva, sumMva, sumInkMva } = beregnFakturaSummer([]);
    expect(sumEksMva).toBe(0);
    expect(sumMva).toBe(0);
    expect(sumInkMva).toBe(0);
  });

  it("håndterer antall > 1 korrekt", () => {
    const linjer = [lagLinje({ antall: 5, enhetspris: 200, mvaSats: 25 })];
    const { sumEksMva, sumMva, sumInkMva } = beregnFakturaSummer(linjer);
    expect(sumEksMva).toBe(1000);
    expect(sumMva).toBe(250);
    expect(sumInkMva).toBe(1250);
  });

  it("runder til 2 desimaler", () => {
    // 0.1 kr enhetspris * 3 antall = 0.30 kr. MVA 25% = 0.075 → 0.08. Total = 0.38
    const linjer = [lagLinje({ antall: 3, enhetspris: 0.1, mvaSats: 25 })];
    const { sumEksMva, sumMva, sumInkMva } = beregnFakturaSummer(linjer);
    // Kontroll at resultatene har maks 2 desimaler
    expect(Number.isFinite(sumEksMva)).toBe(true);
    expect(String(sumEksMva).replace(".", ".").split(".")[1]?.length ?? 0).toBeLessThanOrEqual(2);
    expect(String(sumInkMva).split(".")[1]?.length ?? 0).toBeLessThanOrEqual(2);
    expect(sumMva).toBe(0.08); // Math.round(0.075 * 100) / 100 = 0.08
  });

  it("håndterer 100% rabatt (gratisytelse)", () => {
    const linjer = [lagLinje({ antall: 1, enhetspris: 1000, mvaSats: 25, rabatt: 100 })];
    const { sumEksMva, sumMva, sumInkMva } = beregnFakturaSummer(linjer);
    expect(sumEksMva).toBe(0);
    expect(sumMva).toBe(0);
    expect(sumInkMva).toBe(0);
  });
});
