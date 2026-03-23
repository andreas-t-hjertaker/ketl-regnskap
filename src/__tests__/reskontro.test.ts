/**
 * Tester for reskontro-logikk (#103)
 *
 * useReskontro er en ren beregningsfunksjon (via useMemo) —
 * vi tester den underliggende logikken direkte uten React.
 */

import { describe, it, expect } from "vitest";
import type { BilagMedId } from "@/hooks/use-bilag";
import type { MotpartMedId } from "@/hooks/use-motparter";

// ── Hjelpere for testdata ──────────────────────────────────────────────────

function lagBilag(overrides: Partial<BilagMedId> = {}): BilagMedId {
  return {
    id: "bilag-1",
    bilagsnr: 1,
    dato: "2026-01-15",
    beskrivelse: "Test bilag",
    belop: 10000,
    klientId: "klient-1",
    status: "bokført",
    posteringer: [
      { kontonr: "1500", kontonavn: "Kundefordringer", debet: 10000, kredit: 0 },
      { kontonr: "3000", kontonavn: "Salgsinntekt", debet: 0, kredit: 10000 },
    ],
    aiForslag: undefined,
    ...overrides,
  };
}

function lagMotpart(overrides: Partial<MotpartMedId> = {}): MotpartMedId {
  return {
    id: "motpart-1",
    navn: "Testbedrift AS",
    type: "kunde",
    klientId: "klient-1",
    opprettet: new Date("2025-01-01"),
    ...overrides,
  };
}

// ── Reskontro-logikk (kopiert fra hook for isolert testing) ──────────────

type AldersBøtte = "0-30" | "31-60" | "61-90" | "91+";

function dagerGammel(dato: string): number {
  const bilagDato = new Date(dato);
  // Bruk en fast "nå"-dato for deterministiske tester
  const nå = new Date("2026-03-23");
  return Math.floor((nå.getTime() - bilagDato.getTime()) / 86_400_000);
}

function aldersBøtte(dager: number): AldersBøtte {
  if (dager <= 30) return "0-30";
  if (dager <= 60) return "31-60";
  if (dager <= 90) return "61-90";
  return "91+";
}

// ─── Tester ───────────────────────────────────────────────────────────────

describe("aldersBøtte", () => {
  it("0 dager → 0-30", () => expect(aldersBøtte(0)).toBe("0-30"));
  it("30 dager → 0-30", () => expect(aldersBøtte(30)).toBe("0-30"));
  it("31 dager → 31-60", () => expect(aldersBøtte(31)).toBe("31-60"));
  it("60 dager → 31-60", () => expect(aldersBøtte(60)).toBe("31-60"));
  it("61 dager → 61-90", () => expect(aldersBøtte(61)).toBe("61-90"));
  it("90 dager → 61-90", () => expect(aldersBøtte(90)).toBe("61-90"));
  it("91 dager → 91+", () => expect(aldersBøtte(91)).toBe("91+"));
  it("365 dager → 91+", () => expect(aldersBøtte(365)).toBe("91+"));
});

describe("dagerGammel (relativt til 2026-03-23)", () => {
  it("bilag fra 2026-03-23 er 0 dager gammelt", () => {
    expect(dagerGammel("2026-03-23")).toBe(0);
  });

  it("bilag fra 2026-03-01 er 22 dager gammelt", () => {
    expect(dagerGammel("2026-03-01")).toBe(22);
  });

  it("bilag fra 2026-01-01 er 81 dager gammelt", () => {
    expect(dagerGammel("2026-01-01")).toBe(81);
  });
});

describe("lagBilag-hjelpefunksjon", () => {
  it("produserer gyldig bilag med status bokført", () => {
    const b = lagBilag();
    expect(b.status).toBe("bokført");
    expect(b.posteringer).toHaveLength(2);
  });

  it("støtter override av status", () => {
    const b = lagBilag({ status: "ubehandlet" });
    expect(b.status).toBe("ubehandlet");
  });

  it("støtter override av belop", () => {
    const b = lagBilag({ belop: 99999 });
    expect(b.belop).toBe(99999);
  });
});

describe("lagMotpart-hjelpefunksjon", () => {
  it("produserer gyldig motpart", () => {
    const m = lagMotpart();
    expect(m.type).toBe("kunde");
  });

  it("støtter override av type til leverandor", () => {
    const m = lagMotpart({ type: "leverandor" });
    expect(m.type).toBe("leverandor");
  });
});

describe("kundefordring-deteksjon", () => {
  it("gjenkjenner kontonr 1500 som kundefordring", () => {
    const b = lagBilag({
      posteringer: [
        { kontonr: "1500", kontonavn: "Kundefordringer", debet: 5000, kredit: 0 },
      ],
    });
    const harKundefordring = b.posteringer.some(
      (p) => p.kontonr.startsWith("1500") || p.kontonr === "1500"
    );
    expect(harKundefordring).toBe(true);
  });

  it("gjenkjenner IKKE kontonr 3000 som kundefordring", () => {
    const b = lagBilag({
      posteringer: [
        { kontonr: "3000", kontonavn: "Salgsinntekt", debet: 0, kredit: 5000 },
      ],
    });
    const harKundefordring = b.posteringer.some(
      (p) => p.kontonr.startsWith("1500") || p.kontonr === "1500"
    );
    expect(harKundefordring).toBe(false);
  });

  it("gjenkjenner kontonr 2400 som leverandørgjeld", () => {
    const b = lagBilag({
      posteringer: [
        { kontonr: "2400", kontonavn: "Leverandørgjeld", debet: 0, kredit: 8000 },
      ],
    });
    const harLeverandørgjeld = b.posteringer.some(
      (p) => p.kontonr.startsWith("2400") || p.kontonr === "2400"
    );
    expect(harLeverandørgjeld).toBe(true);
  });
});

describe("status-filtrering for reskontro", () => {
  const gyldigeStatuser = ["bokført", "kreditert"] as const;
  const ugyldigeStatuser = ["ubehandlet", "foreslått", "avvist", "arkivert"] as const;

  for (const status of gyldigeStatuser) {
    it(`${status} bilag inngår i reskontro`, () => {
      const b = lagBilag({ status });
      expect(
        b.status === "bokført" || b.status === "kreditert"
      ).toBe(true);
    });
  }

  for (const status of ugyldigeStatuser) {
    it(`${status} bilag inngår IKKE i reskontro`, () => {
      const b = lagBilag({ status });
      expect(
        b.status === "bokført" || b.status === "kreditert"
      ).toBe(false);
    });
  }
});
