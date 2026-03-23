/**
 * Tester for CSV-eksport-funksjoner
 *
 * csvCelle, byggCsv, nokStr, byggBilagCsv, byggPosteringerCsv,
 * byggResultatCsv og byggKlienterCsv er rene funksjoner — enkelt å enhetsteste.
 * Tester escaping, UTF-8 BOM, kolonnestruktur og NOK-formatering.
 */

import { describe, it, expect } from "vitest";
import {
  csvCelle,
  byggCsv,
  nokStr,
  byggBilagCsv,
  byggPosteringerCsv,
  byggResultatCsv,
  byggKlienterCsv,
} from "@/lib/eksport";
import type { BilagMedId } from "@/hooks/use-bilag";
import type { Resultatregnskap } from "@/hooks/use-rapporter";
import type { Klient } from "@/types";

// ─── csvCelle ─────────────────────────────────────────────────────────────────

describe("csvCelle", () => {
  it("returnerer tekst uten escaping for enkle verdier", () => {
    expect(csvCelle("Konsulenttime")).toBe("Konsulenttime");
  });

  it("wrapper i anførselstegn når verdien inneholder komma", () => {
    expect(csvCelle("Hansen, Olsen AS")).toBe('"Hansen, Olsen AS"');
  });

  it("dobler anførselstegn i verdien", () => {
    expect(csvCelle('Klient "A"')).toBe('"Klient ""A"""');
  });

  it("wrapper i anførselstegn når verdien inneholder linjeskift", () => {
    const verdi = "linje1\nlinje2";
    expect(csvCelle(verdi)).toBe('"linje1\nlinje2"');
  });

  it("returnerer tom streng for null", () => {
    expect(csvCelle(null)).toBe("");
  });

  it("returnerer tom streng for undefined", () => {
    expect(csvCelle(undefined)).toBe("");
  });

  it("konverterer tall til streng", () => {
    expect(csvCelle(12345)).toBe("12345");
  });

  it("konverterer boolean til streng", () => {
    expect(csvCelle(true)).toBe("true");
  });
});

// ─── nokStr ──────────────────────────────────────────────────────────────────

describe("nokStr", () => {
  it("formaterer heltall med to desimaler og komma", () => {
    expect(nokStr(1000)).toBe("1000,00");
  });

  it("formaterer desimaltall med komma", () => {
    expect(nokStr(1234.5)).toBe("1234,50");
  });

  it("formaterer null (0)", () => {
    expect(nokStr(0)).toBe("0,00");
  });

  it("formaterer negativt beløp", () => {
    expect(nokStr(-500)).toBe("-500,00");
  });
});

// ─── byggCsv ─────────────────────────────────────────────────────────────────

describe("byggCsv", () => {
  it("starter med UTF-8 BOM (\\uFEFF)", () => {
    const csv = byggCsv(["A", "B"], [["1", "2"]]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it("første linje er header-raden", () => {
    const csv = byggCsv(["Navn", "Beløp"], []);
    const linjer = csv.slice(1).split("\r\n"); // fjern BOM
    expect(linjer[0]).toBe("Navn,Beløp");
  });

  it("bruker CRLF som linjeskiller (RFC 4180)", () => {
    const csv = byggCsv(["A"], [["1"], ["2"]]);
    expect(csv).toContain("\r\n");
  });

  it("bygger korrekt antall rader", () => {
    const csv = byggCsv(["H"], [["r1"], ["r2"], ["r3"]]);
    const linjer = csv.slice(1).split("\r\n");
    expect(linjer).toHaveLength(4); // header + 3 rader
  });

  it("escaperer celler med komma", () => {
    const csv = byggCsv(["Navn"], [['Hansen, Olsen']]);
    expect(csv).toContain('"Hansen, Olsen"');
  });
});

// ─── Hjelpere for testdata ────────────────────────────────────────────────────

function lagBilag(overrides: Partial<BilagMedId> = {}): BilagMedId {
  return {
    id: "b1",
    bilagsnr: 1,
    dato: "2026-01-15",
    beskrivelse: "Konsulentfaktura",
    klientId: "k1",
    belop: 1250,
    status: "bokført",
    posteringer: [],
    ...overrides,
  } as BilagMedId;
}

// ─── byggBilagCsv ─────────────────────────────────────────────────────────────

describe("byggBilagCsv", () => {
  it("inneholder header-kolonne Bilagsnr", () => {
    const csv = byggBilagCsv([lagBilag()]);
    const header = csv.split("\r\n")[0];
    expect(header).toContain("Bilagsnr");
  });

  it("inneholder bilagsnummer i data-raden", () => {
    const csv = byggBilagCsv([lagBilag({ bilagsnr: 42 })]);
    expect(csv).toContain("42");
  });

  it("viser Ja for bilag med vedlegg, Nei uten", () => {
    const medVedlegg = lagBilag({ vedleggUrl: "https://example.com/fil.pdf" });
    const utenVedlegg = lagBilag({ vedleggUrl: undefined });
    expect(byggBilagCsv([medVedlegg])).toContain("Ja");
    expect(byggBilagCsv([utenVedlegg])).toContain("Nei");
  });

  it("slår opp motpartsnavn fra motparter-liste", () => {
    const bilag = lagBilag({ motpartId: "m1" });
    const motparter = [{ id: "m1", navn: "Leverandør AS", type: "leverandor" as const, klientId: "k1", opprettet: new Date() }];
    const csv = byggBilagCsv([bilag], motparter);
    expect(csv).toContain("Leverandør AS");
  });

  it("returnerer motpartId når motparten ikke finnes i listen", () => {
    const bilag = lagBilag({ motpartId: "ukjent-id" });
    const csv = byggBilagCsv([bilag], []);
    expect(csv).toContain("ukjent-id");
  });

  it("formaterer beløp med norsk komma", () => {
    const csv = byggBilagCsv([lagBilag({ belop: 1250.5 })]);
    expect(csv).toContain("1250,50");
  });

  it("viser kryssreferanse til krediterende bilag", () => {
    const kreditert = lagBilag({ id: "b2", bilagsnr: 2 });
    const original = lagBilag({ id: "b1", bilagsnr: 1, kreditertAvId: "b2" });
    const csv = byggBilagCsv([original, kreditert]);
    // Kreditert av-kolonnen skal vise bilagsnr (2), ikke id (b2)
    const dataRad = csv.split("\r\n")[1];
    expect(dataRad).toContain(",2,");
  });

  it("returnerer tom CSV (kun header) for tom bilagliste", () => {
    const csv = byggBilagCsv([]);
    const linjer = csv.slice(1).split("\r\n");
    expect(linjer).toHaveLength(1); // kun header
  });
});

// ─── byggPosteringerCsv ───────────────────────────────────────────────────────

describe("byggPosteringerCsv", () => {
  it("inneholder Kontonr og Kontonavn i header", () => {
    const csv = byggPosteringerCsv([]);
    expect(csv).toContain("Kontonr");
    expect(csv).toContain("Kontonavn");
  });

  it("lager én rad per postering, ikke per bilag", () => {
    const bilag = lagBilag({
      posteringer: [
        { kontonr: "3000", kontonavn: "Salgsinntekt", debet: 0, kredit: 1000 },
        { kontonr: "1500", kontonavn: "Kundefordringer", debet: 1000, kredit: 0 },
      ] as BilagMedId["posteringer"],
    });
    const csv = byggPosteringerCsv([bilag]);
    const linjer = csv.slice(1).split("\r\n");
    expect(linjer).toHaveLength(3); // header + 2 posteringsrader
  });

  it("viser 0,00 for manglende debet/kredit", () => {
    const bilag = lagBilag({
      posteringer: [
        { kontonr: "3000", kontonavn: "Salgsinntekt", kredit: 500 },
      ] as BilagMedId["posteringer"],
    });
    const csv = byggPosteringerCsv([bilag]);
    expect(csv).toContain("0,00");
  });
});

// ─── byggResultatCsv ──────────────────────────────────────────────────────────

const testResultat: Resultatregnskap = {
  driftsinntekter: [{ konto: "3000", navn: "Salgsinntekter", belop: 50000 }],
  driftskostnader: [{ konto: "5000", navn: "Lønnskostnader", belop: 30000 }],
  totalInntekter: 50000,
  totalKostnader: 30000,
  resultat: 20000,
};

describe("byggResultatCsv", () => {
  it("inneholder DRIFTSINNTEKTER-seksjon", () => {
    const csv = byggResultatCsv(testResultat, "2026");
    expect(csv).toContain("DRIFTSINNTEKTER");
  });

  it("inneholder DRIFTSKOSTNADER-seksjon", () => {
    const csv = byggResultatCsv(testResultat, "2026");
    expect(csv).toContain("DRIFTSKOSTNADER");
  });

  it("viser sum inntekter korrekt formatert", () => {
    const csv = byggResultatCsv(testResultat, "2026");
    expect(csv).toContain("50000,00");
  });

  it("viser RESULTAT FØR SKATT", () => {
    const csv = byggResultatCsv(testResultat, "2026");
    expect(csv).toContain("RESULTAT FØR SKATT");
    expect(csv).toContain("20000,00");
  });

  it("inkluderer kontonavn fra driftsinntekter", () => {
    const csv = byggResultatCsv(testResultat, "2026");
    expect(csv).toContain("Salgsinntekter");
  });
});

// ─── byggKlienterCsv ─────────────────────────────────────────────────────────

type KlientMedId = Klient & { id: string };

function lagKlient(overrides: Partial<KlientMedId> = {}): KlientMedId {
  return {
    id: "k1",
    navn: "Test AS",
    orgnr: "123456789",
    kontaktperson: "Ola Nordmann",
    epost: "ola@test.no",
    ...overrides,
  } as KlientMedId;
}

describe("byggKlienterCsv", () => {
  it("inneholder Firmanavn i header", () => {
    const csv = byggKlienterCsv([lagKlient()]);
    expect(csv).toContain("Firmanavn");
  });

  it("inneholder klientens navn og orgnr", () => {
    const csv = byggKlienterCsv([lagKlient({ navn: "Norsk Bedrift AS", orgnr: "987654321" })]);
    expect(csv).toContain("Norsk Bedrift AS");
    expect(csv).toContain("987654321");
  });

  it("escaperer firmanavn med komma", () => {
    const csv = byggKlienterCsv([lagKlient({ navn: "Hansen, Olsen & Co" })]);
    expect(csv).toContain('"Hansen, Olsen & Co"');
  });

  it("lager én rad per klient", () => {
    const klienter = [lagKlient({ id: "k1" }), lagKlient({ id: "k2", navn: "Andre AS" })];
    const csv = byggKlienterCsv(klienter);
    const linjer = csv.slice(1).split("\r\n");
    expect(linjer).toHaveLength(3); // header + 2 klienter
  });

  it("returnerer tom CSV (kun header) for tom klientliste", () => {
    const csv = byggKlienterCsv([]);
    const linjer = csv.slice(1).split("\r\n");
    expect(linjer).toHaveLength(1);
  });
});
