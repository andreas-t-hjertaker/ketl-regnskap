/**
 * Tester for avskrivningslogikk (#103)
 *
 * beregnAvskrivningsplan er en ren funksjon — enkelt å enhetsteste.
 */

import { describe, it, expect } from "vitest";
import {
  beregnAvskrivningsplan,
  årsavskrivning,
} from "@/hooks/use-anleggsmidler";
import type { Anleggsmiddel } from "@/types";

function lagAnleggsmiddel(overrides: Partial<Anleggsmiddel> = {}): Anleggsmiddel {
  return {
    klientId: "klient-1",
    navn: "Testmaskin",
    kontonr: "1200",
    kostpris: 100_000,
    anskaffetDato: "2026-01-01",
    levetidÅr: 5,
    metode: "lineær",
    restverdi: 0,
    aktivert: true,
    opprettet: new Date("2026-01-01"),
    ...overrides,
  };
}

// ─── Lineær avskrivning ───────────────────────────────────────────────────

describe("lineær avskrivning", () => {
  it("gir riktig antall linjer (5 år)", () => {
    const plan = beregnAvskrivningsplan(lagAnleggsmiddel({ levetidÅr: 5 }));
    expect(plan).toHaveLength(5);
  });

  it("årsavskrivning er kostpris / levetid når restverdi = 0", () => {
    const a = lagAnleggsmiddel({ kostpris: 100_000, levetidÅr: 5, restverdi: 0 });
    const plan = beregnAvskrivningsplan(a);
    expect(plan[0].avskrivning).toBe(20_000);
    expect(plan[1].avskrivning).toBe(20_000);
  });

  it("tar hensyn til restverdi", () => {
    const a = lagAnleggsmiddel({ kostpris: 100_000, levetidÅr: 5, restverdi: 10_000 });
    const plan = beregnAvskrivningsplan(a);
    // Avskrivbar = 90 000, / 5 = 18 000/år
    expect(plan[0].avskrivning).toBe(18_000);
  });

  it("bokført verdi etter siste år er lik restverdi", () => {
    const restverdi = 5_000;
    const a = lagAnleggsmiddel({ kostpris: 105_000, levetidÅr: 5, restverdi });
    const plan = beregnAvskrivningsplan(a);
    expect(plan[plan.length - 1].bokførtVerdi).toBe(restverdi);
  });

  it("akkumulert avskrivning øker monotont", () => {
    const plan = beregnAvskrivningsplan(lagAnleggsmiddel());
    for (let i = 1; i < plan.length; i++) {
      expect(plan[i].akkumulertAvskrivning).toBeGreaterThan(
        plan[i - 1].akkumulertAvskrivning
      );
    }
  });

  it("bokført verdi avtar monotont", () => {
    const plan = beregnAvskrivningsplan(lagAnleggsmiddel());
    for (let i = 1; i < plan.length; i++) {
      expect(plan[i].bokførtVerdi).toBeLessThan(plan[i - 1].bokførtVerdi);
    }
  });

  it("første år er startÅr fra anskaffetDato", () => {
    const a = lagAnleggsmiddel({ anskaffetDato: "2020-06-15" });
    const plan = beregnAvskrivningsplan(a);
    expect(plan[0].år).toBe(2020);
  });

  it("siste akkumulert = kostpris - restverdi", () => {
    const a = lagAnleggsmiddel({ kostpris: 100_000, restverdi: 0, levetidÅr: 4 });
    const plan = beregnAvskrivningsplan(a);
    expect(plan[plan.length - 1].akkumulertAvskrivning).toBe(100_000);
  });
});

// ─── Saldobasert avskrivning ──────────────────────────────────────────────

describe("saldobasert avskrivning", () => {
  it("avskrivning år 1 = kostpris × sats", () => {
    const a = lagAnleggsmiddel({
      metode: "saldo",
      kostpris: 100_000,
      saldoSats: 20,
      restverdi: 0,
      levetidÅr: 5,
    });
    const plan = beregnAvskrivningsplan(a);
    expect(plan[0].avskrivning).toBe(20_000);
  });

  it("avskrivning år 2 = (kostpris - år1avskrivning) × sats", () => {
    const a = lagAnleggsmiddel({
      metode: "saldo",
      kostpris: 100_000,
      saldoSats: 20,
      restverdi: 0,
      levetidÅr: 5,
    });
    const plan = beregnAvskrivningsplan(a);
    expect(plan[1].avskrivning).toBeCloseTo(16_000, 0);
  });

  it("bokført verdi faller hvert år", () => {
    const a = lagAnleggsmiddel({
      metode: "saldo",
      kostpris: 50_000,
      saldoSats: 30,
      levetidÅr: 6,
    });
    const plan = beregnAvskrivningsplan(a);
    for (let i = 1; i < plan.length; i++) {
      expect(plan[i].bokførtVerdi).toBeLessThan(plan[i - 1].bokførtVerdi);
    }
  });

  it("stopper når bokført verdi ≤ restverdi", () => {
    const a = lagAnleggsmiddel({
      metode: "saldo",
      kostpris: 10_000,
      saldoSats: 50,
      restverdi: 1_000,
      levetidÅr: 20, // lang levetid, men stopper pga. restverdi
    });
    const plan = beregnAvskrivningsplan(a);
    // Siste bokførte verdi skal ikke gå under restverdi
    for (const l of plan) {
      expect(l.bokførtVerdi).toBeGreaterThanOrEqual(1_000 - 1); // toleranse for avrunding
    }
  });
});

// ─── årsavskrivning-hjelpefunksjon ────────────────────────────────────────

describe("årsavskrivning", () => {
  it("returnerer avskrivning for det angitte året", () => {
    const a = lagAnleggsmiddel({
      kostpris: 50_000,
      levetidÅr: 5,
      anskaffetDato: "2024-01-01",
    });
    const avskrivning2024 = årsavskrivning(a, 2024);
    expect(avskrivning2024).toBe(10_000);
  });

  it("returnerer 0 for år utenfor levetiden", () => {
    const a = lagAnleggsmiddel({
      kostpris: 50_000,
      levetidÅr: 3,
      anskaffetDato: "2020-01-01",
    });
    // 2020, 2021, 2022 er innenfor levetiden. 2030 er utenfor.
    expect(årsavskrivning(a, 2030)).toBe(0);
  });

  it("returnerer 0 for år før anskaffelse", () => {
    const a = lagAnleggsmiddel({ anskaffetDato: "2025-06-01" });
    expect(årsavskrivning(a, 2020)).toBe(0);
  });
});
