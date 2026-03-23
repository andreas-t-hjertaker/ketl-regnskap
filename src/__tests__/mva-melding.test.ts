/**
 * Tester for MVA-melding RF-0002
 *
 * byggMvaMelding og genererMvaMeldingXml er rene funksjoner — enkelt å enhetsteste.
 * Dekker terminfrister iht. Mval. § 15-9 og XML-strukturen til RF-0002 v2.0.
 */

import { describe, it, expect } from "vitest";
import {
  byggMvaMelding,
  genererMvaMeldingXml,
  fmtMvaBeløp,
} from "@/lib/mva-melding";
import type { MvaTerm } from "@/hooks/use-rapporter";

// ─── Hjelpere ────────────────────────────────────────────────────────────────

const testKlient = { orgnr: "123456789", navn: "Test AS" };

function lagTermin(overrides: Partial<MvaTerm> = {}): MvaTerm {
  return {
    periode: "2026-T1",
    utgåendeMva: 25000,
    inngåendeMva: 5000,
    åBetale: 20000,
    ...overrides,
  };
}

// ─── byggMvaMelding ───────────────────────────────────────────────────────────

describe("byggMvaMelding", () => {
  it("bygger korrekt MVA-melding for T1", () => {
    const melding = byggMvaMelding(lagTermin({ periode: "2026-T1" }), testKlient);
    expect(melding.klientOrgnr).toBe("123456789");
    expect(melding.klientNavn).toBe("Test AS");
    expect(melding.terminKode).toBe("2026-T1");
    expect(melding.termin).toContain("1. termin 2026");
    expect(melding.termin).toContain("jan-feb");
  });

  it("setter korrekt frist for T1 (10. april iht. Mval. § 15-9)", () => {
    const melding = byggMvaMelding(lagTermin({ periode: "2026-T1" }), testKlient);
    expect(melding.frist).toBe("2026-04-10");
  });

  it("setter korrekt frist for T2 (10. juni)", () => {
    const melding = byggMvaMelding(lagTermin({ periode: "2026-T2" }), testKlient);
    expect(melding.frist).toBe("2026-06-10");
  });

  it("setter korrekt frist for T3 (31. august)", () => {
    const melding = byggMvaMelding(lagTermin({ periode: "2026-T3" }), testKlient);
    expect(melding.frist).toBe("2026-08-31");
  });

  it("setter korrekt frist for T4 (10. oktober)", () => {
    const melding = byggMvaMelding(lagTermin({ periode: "2026-T4" }), testKlient);
    expect(melding.frist).toBe("2026-10-10");
  });

  it("setter korrekt frist for T5 (10. desember)", () => {
    const melding = byggMvaMelding(lagTermin({ periode: "2026-T5" }), testKlient);
    expect(melding.frist).toBe("2026-12-10");
  });

  it("setter korrekt frist for T6 (10. februar neste år)", () => {
    const melding = byggMvaMelding(lagTermin({ periode: "2026-T6" }), testKlient);
    expect(melding.frist).toBe("2027-02-10");
  });

  it("beregner netto å betale korrekt", () => {
    const melding = byggMvaMelding(lagTermin({ utgåendeMva: 30000, inngåendeMva: 10000, åBetale: 20000 }), testKlient);
    expect(melding.sumUtgåendeMva).toBe(30000);
    expect(melding.sumInngåendeMva).toBe(10000);
    expect(melding.nettoÅBetale).toBe(20000);
  });

  it("inkluderer utgående MVA-post i poster", () => {
    const melding = byggMvaMelding(lagTermin({ utgåendeMva: 25000, inngåendeMva: 0, åBetale: 25000 }), testKlient);
    const utgående = melding.poster.find((p) => p.type === "utgåendeMva");
    expect(utgående).toBeDefined();
    expect(utgående?.kode).toBe("3");
    expect(utgående?.mvaBeløp).toBe(25000);
  });

  it("inkluderer inngående MVA-post i poster", () => {
    const melding = byggMvaMelding(lagTermin({ utgåendeMva: 0, inngåendeMva: 5000, åBetale: -5000 }), testKlient);
    const inngående = melding.poster.find((p) => p.type === "inngåendeMva");
    expect(inngående).toBeDefined();
    expect(inngående?.kode).toBe("1");
    expect(inngående?.mvaBeløp).toBe(5000);
  });

  it("utelater poster med 0-verdi", () => {
    const melding = byggMvaMelding(lagTermin({ utgåendeMva: 25000, inngåendeMva: 0, åBetale: 25000 }), testKlient);
    const inngående = melding.poster.find((p) => p.type === "inngåendeMva");
    expect(inngående).toBeUndefined();
  });
});

// ─── genererMvaMeldingXml ─────────────────────────────────────────────────────

describe("genererMvaMeldingXml", () => {
  it("genererer gyldig XML med korrekt namespace", () => {
    const melding = byggMvaMelding(lagTermin(), testKlient);
    const xml = genererMvaMeldingXml(melding);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('urn:no:skatteetaten:fastsetting:avgift:mva:mvamelding:v2.0');
  });

  it("inkluderer organisasjonsnummer i XML", () => {
    const melding = byggMvaMelding(lagTermin(), testKlient);
    const xml = genererMvaMeldingXml(melding);
    expect(xml).toContain("<organisasjonsnummer>123456789</organisasjonsnummer>");
  });

  it("escaper spesialtegn i klientnavn", () => {
    const klientMedSpesialtegn = { orgnr: "123456789", navn: "Klient & Cie <test>" };
    const melding = byggMvaMelding(lagTermin(), klientMedSpesialtegn);
    const xml = genererMvaMeldingXml(melding);
    expect(xml).toContain("Klient &amp; Cie &lt;test&gt;");
    expect(xml).not.toContain("<test>");
  });

  it("inkluderer fastsattMerverdiavgift", () => {
    const melding = byggMvaMelding(lagTermin({ åBetale: 20000 }), testKlient);
    const xml = genererMvaMeldingXml(melding);
    expect(xml).toContain("<fastsattMerverdiavgift>20000</fastsattMerverdiavgift>");
  });
});

// ─── fmtMvaBeløp ─────────────────────────────────────────────────────────────

describe("fmtMvaBeløp", () => {
  it("formaterer positive beløp på norsk", () => {
    const resultat = fmtMvaBeløp(25000);
    expect(resultat).toContain("25");
    expect(resultat).toContain("000");
  });

  it("formaterer 0", () => {
    const resultat = fmtMvaBeløp(0);
    expect(resultat).toContain("0");
  });
});
