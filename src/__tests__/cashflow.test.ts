/**
 * Tester for cashflow-beregning og prosjektresultater
 *
 * beregnProsjektResultater er en ren funksjon — enkelt å enhetsteste.
 * Cashflow-logikken testes indirekte via de eksporterte hjelper-funksjonene.
 */

import { describe, it, expect } from "vitest";
import {
  beregnProsjektResultater,
  type ProsjektMedId,
} from "@/hooks/use-prosjekter";
import type { BilagMedId } from "@/hooks/use-bilag";

// ─── Hjelpere ────────────────────────────────────────────────────────────────

function lagProsjekt(overrides: Partial<ProsjektMedId> = {}): ProsjektMedId {
  return {
    id: "prosjekt-1",
    navn: "Testprosjekt",
    klientId: "klient-1",
    status: "aktiv",
    opprettet: new Date(),
    ...overrides,
  } as ProsjektMedId;
}

function lagBilag(overrides: Partial<BilagMedId> = {}): BilagMedId {
  return {
    id: "bilag-1",
    bilagsnr: 1,
    dato: "2026-03-10",
    beskrivelse: "Testbilag",
    belop: 1000,
    klientId: "klient-1",
    status: "bokført",
    posteringer: [],
    ...overrides,
  } as BilagMedId;
}

// ─── beregnProsjektResultater ─────────────────────────────────────────────────

describe("beregnProsjektResultater", () => {
  it("returnerer tomt resultat for prosjekt uten bilag", () => {
    const prosjekter = [lagProsjekt()];
    const bilag: BilagMedId[] = [];
    const [res] = beregnProsjektResultater(prosjekter, bilag);
    expect(res.inntekter).toBe(0);
    expect(res.kostnader).toBe(0);
    expect(res.resultat).toBe(0);
    expect(res.antallBilag).toBe(0);
  });

  it("beregner inntekter fra konto 3xxx", () => {
    const prosjekter = [lagProsjekt({ id: "p1" })];
    const bilag = [
      lagBilag({
        prosjektId: "p1",
        status: "bokført",
        posteringer: [
          { kontonr: "3000", kontonavn: "Salgsinntekt", debet: 0, kredit: 10000 },
        ],
      }),
    ];
    const [res] = beregnProsjektResultater(prosjekter, bilag);
    expect(res.inntekter).toBe(10000);
    expect(res.kostnader).toBe(0);
    expect(res.resultat).toBe(10000);
    expect(res.antallBilag).toBe(1);
  });

  it("beregner kostnader fra konto 4xxx–8xxx", () => {
    const prosjekter = [lagProsjekt({ id: "p1" })];
    const bilag = [
      lagBilag({
        prosjektId: "p1",
        status: "bokført",
        posteringer: [
          { kontonr: "6500", kontonavn: "Kontorkostnader", debet: 5000, kredit: 0 },
        ],
      }),
    ];
    const [res] = beregnProsjektResultater(prosjekter, bilag);
    expect(res.kostnader).toBe(5000);
    expect(res.inntekter).toBe(0);
    expect(res.resultat).toBe(-5000);
  });

  it("tar ikke med bilag som tilhører annet prosjekt", () => {
    const prosjekter = [lagProsjekt({ id: "p1" })];
    const bilag = [
      lagBilag({
        prosjektId: "p2",
        status: "bokført",
        posteringer: [{ kontonr: "6500", kontonavn: "Kostnad", debet: 5000, kredit: 0 }],
      }),
    ];
    const [res] = beregnProsjektResultater(prosjekter, bilag);
    expect(res.kostnader).toBe(0);
    expect(res.antallBilag).toBe(0);
  });

  it("utelater bilag som ikke er bokført/kreditert", () => {
    const prosjekter = [lagProsjekt({ id: "p1" })];
    const bilag = [
      lagBilag({
        prosjektId: "p1",
        status: "ubehandlet",
        posteringer: [{ kontonr: "3000", kontonavn: "Inntekt", debet: 0, kredit: 10000 }],
      }),
      lagBilag({
        id: "b2",
        prosjektId: "p1",
        status: "foreslått",
        posteringer: [{ kontonr: "3000", kontonavn: "Inntekt", debet: 0, kredit: 5000 }],
      }),
    ];
    const [res] = beregnProsjektResultater(prosjekter, bilag);
    expect(res.inntekter).toBe(0);
    expect(res.antallBilag).toBe(0);
  });

  it("inkluderer krediterte bilag", () => {
    const prosjekter = [lagProsjekt({ id: "p1" })];
    const bilag = [
      lagBilag({
        prosjektId: "p1",
        status: "kreditert",
        posteringer: [{ kontonr: "3000", kontonavn: "Inntekt", debet: 0, kredit: 8000 }],
      }),
    ];
    const [res] = beregnProsjektResultater(prosjekter, bilag);
    expect(res.inntekter).toBe(8000);
  });

  it("beregner forbrukPst korrekt", () => {
    const prosjekter = [lagProsjekt({ id: "p1", budsjett: 20000 })];
    const bilag = [
      lagBilag({
        prosjektId: "p1",
        status: "bokført",
        posteringer: [{ kontonr: "6500", kontonavn: "Kostnad", debet: 10000, kredit: 0 }],
      }),
    ];
    const [res] = beregnProsjektResultater(prosjekter, bilag);
    expect(res.forbrukPst).toBe(50); // 10 000 / 20 000 = 50%
  });

  it("begrenser forbrukPst til 999", () => {
    const prosjekter = [lagProsjekt({ id: "p1", budsjett: 1000 })];
    const bilag = [
      lagBilag({
        prosjektId: "p1",
        status: "bokført",
        posteringer: [{ kontonr: "6500", kontonavn: "Kostnad", debet: 100000, kredit: 0 }],
      }),
    ];
    const [res] = beregnProsjektResultater(prosjekter, bilag);
    expect(res.forbrukPst).toBe(999);
  });

  it("returnerer forbrukPst=0 for prosjekt uten budsjett", () => {
    const prosjekter = [lagProsjekt({ id: "p1", budsjett: undefined })];
    const bilag = [
      lagBilag({
        prosjektId: "p1",
        status: "bokført",
        posteringer: [{ kontonr: "6500", kontonavn: "Kostnad", debet: 5000, kredit: 0 }],
      }),
    ];
    const [res] = beregnProsjektResultater(prosjekter, bilag);
    expect(res.forbrukPst).toBe(0);
  });

  it("håndterer flere prosjekter", () => {
    const prosjekter = [
      lagProsjekt({ id: "p1", navn: "Prosjekt A" }),
      lagProsjekt({ id: "p2", navn: "Prosjekt B" }),
    ];
    const bilag = [
      lagBilag({
        id: "b1",
        prosjektId: "p1",
        status: "bokført",
        posteringer: [{ kontonr: "3000", kontonavn: "Inntekt", debet: 0, kredit: 5000 }],
      }),
      lagBilag({
        id: "b2",
        prosjektId: "p2",
        status: "bokført",
        posteringer: [{ kontonr: "6500", kontonavn: "Kostnad", debet: 3000, kredit: 0 }],
      }),
    ];
    const resultater = beregnProsjektResultater(prosjekter, bilag);
    expect(resultater[0].inntekter).toBe(5000);
    expect(resultater[0].kostnader).toBe(0);
    expect(resultater[1].inntekter).toBe(0);
    expect(resultater[1].kostnader).toBe(3000);
  });
});
