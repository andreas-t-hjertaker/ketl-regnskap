/**
 * Tester for bankkontoavstemming (#97)
 *
 * parseBankCSV og finnMatchKandidater er rene funksjoner — enkelt å enhetsteste.
 */

import { describe, it, expect } from "vitest";
import {
  parseBankCSV,
  finnMatchKandidater,
  type BankTransaksjonMedId,
} from "@/hooks/use-bank-avstemming";
import type { BilagMedId } from "@/hooks/use-bilag";

// ─── Hjelpere ────────────────────────────────────────────────────────────────

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

function lagTransaksjon(overrides: Partial<BankTransaksjonMedId> = {}): BankTransaksjonMedId {
  return {
    id: "tx-1",
    dato: "2026-03-10",
    beskrivelseBank: "Test transaksjon",
    beløp: -1000,
    status: "umatchet",
    importertDato: null,
    ...overrides,
  };
}

// ─── parseBankCSV ─────────────────────────────────────────────────────────────

describe("parseBankCSV — DNB-format", () => {
  const dnbHeader = `"Dato";"Forklaring";"Rentedato";"Ut fra konto";"Inn på konto"`;

  it("parser en enkelt inn-transaksjon", () => {
    const csv = `${dnbHeader}\n"10.03.2026";"Lønn fra AS";"10.03.2026";"0,00";"25 000,00"`;
    const result = parseBankCSV(csv);
    expect(result).toHaveLength(1);
    expect(result[0].dato).toBe("2026-03-10");
    expect(result[0].beskrivelseBank).toBe("Lønn fra AS");
    expect(result[0].beløp).toBe(25000);
  });

  it("parser en ut-transaksjon", () => {
    const csv = `${dnbHeader}\n"15.03.2026";"Husleie";"15.03.2026";"12 500,00";"0,00"`;
    const result = parseBankCSV(csv);
    expect(result).toHaveLength(1);
    expect(result[0].beløp).toBe(-12500);
  });

  it("hopper over rader med beløp=0", () => {
    const csv = `${dnbHeader}\n"10.03.2026";"Tom rad";"10.03.2026";"0,00";"0,00"`;
    const result = parseBankCSV(csv);
    expect(result).toHaveLength(0);
  });

  it("parser flere rader", () => {
    const csv = [
      dnbHeader,
      `"01.03.2026";"Betaling A";"01.03.2026";"500,00";"0,00"`,
      `"02.03.2026";"Betaling B";"02.03.2026";"0,00";"1 000,00"`,
    ].join("\n");
    const result = parseBankCSV(csv);
    expect(result).toHaveLength(2);
  });
});

describe("parseBankCSV — Nordea/Sparebank 1-format", () => {
  const nordeaHeader = `"Bokføringsdato";"Beløp";"Avsender";"Mottaker";"Navn";"Tittel";"Valuta";"saldo"`;

  it("parser inn-transaksjon", () => {
    const csv = `${nordeaHeader}\n"10.03.2026";"2 500,00";"SE123";"NO456";"ACME AS";"Faktura 42";"NOK";"10 000,00"`;
    const result = parseBankCSV(csv);
    expect(result).toHaveLength(1);
    expect(result[0].dato).toBe("2026-03-10");
    expect(result[0].beløp).toBe(2500);
    expect(result[0].beskrivelseBank).toBe("ACME AS — Faktura 42");
  });

  it("lagrer saldo", () => {
    const csv = `${nordeaHeader}\n"10.03.2026";"-1 000,00";"SE123";"NO456";"Klient";"Betaling";"NOK";"50 000,00"`;
    const result = parseBankCSV(csv);
    expect(result[0].saldo).toBe(50000);
  });
});

describe("parseBankCSV — Handelsbanken-format", () => {
  it("parser standard Handelsbanken CSV", () => {
    const csv = [
      `Date;Text;Amount;Balance`,
      `2026-03-10;Betaling kontorrekvisita;-800.00;24200.00`,
    ].join("\n");
    const result = parseBankCSV(csv);
    expect(result).toHaveLength(1);
    expect(result[0].dato).toBe("2026-03-10");
    expect(result[0].beskrivelseBank).toBe("Betaling kontorrekvisita");
    expect(result[0].beløp).toBe(-800);
    expect(result[0].saldo).toBe(24200);
  });

  it("støtter anførselstegn-variant", () => {
    const csv = [
      `"Date";"Text";"Amount";"Balance"`,
      `"2026-03-10";"Leie";"3 500,00";"20 000,00"`,
    ].join("\n");
    const result = parseBankCSV(csv);
    expect(result).toHaveLength(1);
    expect(result[0].beløp).toBe(3500);
  });
});

describe("parseBankCSV — ukjent format", () => {
  it("returnerer tom array for ukjent CSV-format", () => {
    const csv = `Kolonne1,Kolonne2,Kolonne3\n1,2,3`;
    expect(parseBankCSV(csv)).toHaveLength(0);
  });

  it("returnerer tom array for tom streng", () => {
    expect(parseBankCSV("")).toHaveLength(0);
  });

  it("returnerer tom array for kun header", () => {
    expect(parseBankCSV(`"Dato";"Forklaring";"Rentedato";"Ut fra konto";"Inn på konto"`)).toHaveLength(0);
  });
});

// ─── finnMatchKandidater ──────────────────────────────────────────────────────

describe("finnMatchKandidater", () => {
  it("matcher bilag med eksakt beløp og dato", () => {
    const tx = lagTransaksjon({ beløp: -1000, dato: "2026-03-10" });
    const bilag = [lagBilag({ belop: 1000, dato: "2026-03-10", status: "bokført" })];
    const treff = finnMatchKandidater(tx, bilag);
    expect(treff).toHaveLength(1);
  });

  it("matcher innenfor ±3 dager", () => {
    const tx = lagTransaksjon({ beløp: -500, dato: "2026-03-10" });
    const bilag = [
      lagBilag({ id: "b1", belop: 500, dato: "2026-03-13", status: "bokført" }),
      lagBilag({ id: "b2", belop: 500, dato: "2026-03-07", status: "bokført" }),
    ];
    const treff = finnMatchKandidater(tx, bilag);
    expect(treff).toHaveLength(2);
  });

  it("utelukker bilag utenfor ±3 dager", () => {
    const tx = lagTransaksjon({ beløp: -500, dato: "2026-03-10" });
    const bilag = [
      lagBilag({ id: "b1", belop: 500, dato: "2026-03-14", status: "bokført" }),
      lagBilag({ id: "b2", belop: 500, dato: "2026-03-06", status: "bokført" }),
    ];
    const treff = finnMatchKandidater(tx, bilag);
    expect(treff).toHaveLength(0);
  });

  it("tolererer beløpsavvik opp til 1 NOK", () => {
    const tx = lagTransaksjon({ beløp: -1000.50, dato: "2026-03-10" });
    const bilag = [lagBilag({ belop: 1001, dato: "2026-03-10", status: "bokført" })];
    const treff = finnMatchKandidater(tx, bilag);
    expect(treff).toHaveLength(1);
  });

  it("utelukker bilag med avvik over 1 NOK", () => {
    const tx = lagTransaksjon({ beløp: -1000, dato: "2026-03-10" });
    const bilag = [lagBilag({ belop: 1002, dato: "2026-03-10", status: "bokført" })];
    const treff = finnMatchKandidater(tx, bilag);
    expect(treff).toHaveLength(0);
  });

  it("utelukker bilag med status != bokført/kreditert", () => {
    const tx = lagTransaksjon({ beløp: -1000, dato: "2026-03-10" });
    const bilag = [
      lagBilag({ id: "b1", belop: 1000, dato: "2026-03-10", status: "ubehandlet" }),
      lagBilag({ id: "b2", belop: 1000, dato: "2026-03-10", status: "foreslått" }),
      lagBilag({ id: "b3", belop: 1000, dato: "2026-03-10", status: "kreditert" }),
    ];
    const treff = finnMatchKandidater(tx, bilag);
    expect(treff).toHaveLength(1);
    expect(treff[0].id).toBe("b3");
  });

  it("returnerer tom array når ingen bilag matcher", () => {
    const tx = lagTransaksjon({ beløp: -9999, dato: "2026-03-10" });
    const bilag = [lagBilag({ belop: 1000, dato: "2026-03-10", status: "bokført" })];
    const treff = finnMatchKandidater(tx, bilag);
    expect(treff).toHaveLength(0);
  });

  it("håndterer positivt beløp i transaksjon (inn)", () => {
    const tx = lagTransaksjon({ beløp: 5000, dato: "2026-03-10" });
    const bilag = [lagBilag({ belop: 5000, dato: "2026-03-10", status: "bokført" })];
    const treff = finnMatchKandidater(tx, bilag);
    expect(treff).toHaveLength(1);
  });
});
