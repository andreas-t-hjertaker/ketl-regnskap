/**
 * SAF-T Financial 1.30 — XML-generator iht. Skatteetatens spesifikasjon.
 * Referanse: https://www.skatteetaten.no/globalassets/bedrift-og-organisasjon/starte-og-drive/rutiner-regnskap-og-kassasystem/saf-t-regnskap/norwegian-saf-t-financial-data---documentation-and-guidelines.pdf
 */

import { NS4102_KONTOPLAN, finnMvaKode } from "@/lib/kontoplan";
import type { Bilag, Klient, Postering } from "@/types";

type SaftEksportValg = {
  bilag: (Bilag & { id: string })[];
  klient: Klient;
  periodeStart?: string; // ISO date "2026-01-01"
  periodeSlutt?: string; // ISO date "2026-12-31"
};

/** Escaper XML-spesialtegn */
function xmlEsc(s: string | undefined | null): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Formater beløp til SAF-T-format (maks 2 desimaler, punkt som desimalskilletegn) */
function saftBeløp(n: number): string {
  return Math.abs(n).toFixed(2);
}

/** ISO date → periode-nummer (1-12) */
function månedNr(dato: string): number {
  return parseInt(dato.slice(5, 7), 10);
}

/** ISO date → år */
function årNr(dato: string): number {
  return parseInt(dato.slice(0, 4), 10);
}

/** Generer SAF-T Financial 1.30 XML som streng */
export function genererSaftXml(valg: SaftEksportValg): string {
  const { bilag, klient } = valg;
  const nå = new Date();
  const datoCreated = nå.toISOString().slice(0, 10);

  // Bokførte bilag med posteringer
  const bokførteBilag = bilag.filter(
    (b) => b.status === "bokført" || b.status === "kreditert"
  );

  // Finn alle kontonumre brukt i posteringene
  const brukteKontoer = new Set<string>();
  for (const b of bokførteBilag) {
    for (const p of b.posteringer) brukteKontoer.add(p.kontonr);
  }

  // Beregn totaler
  const totalDebet = bokførteBilag
    .flatMap((b) => b.posteringer)
    .reduce((s, p) => s + (p.debet ?? 0), 0);
  const totalKredit = bokførteBilag
    .flatMap((b) => b.posteringer)
    .reduce((s, p) => s + (p.kredit ?? 0), 0);

  // Periodeheader
  const datoer = bokførteBilag.map((b) => b.dato).sort();
  const periodeStart = valg.periodeStart ?? datoer[0] ?? datoCreated;
  const periodeSlutt = valg.periodeSlutt ?? datoer[datoer.length - 1] ?? datoCreated;
  const startÅr = periodeStart.slice(0, 4);
  const startMnd = periodeStart.slice(5, 7);
  const sluttÅr = periodeSlutt.slice(0, 4);
  const sluttMnd = periodeSlutt.slice(5, 7);

  // ── Bygg XML ────────────────────────────────────────────────────────────────

  const lines: string[] = [];

  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  lines.push(`<AuditFile xmlns="urn:StandardAuditFile-Taxation-Financial:NO"`);
  lines.push(`           xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"`);
  lines.push(`           xsi:schemaLocation="urn:StandardAuditFile-Taxation-Financial:NO SAF-T_Financial_Version_1.30.xsd">`);

  // ── Header ──────────────────────────────────────────────────────────────────
  lines.push(`  <Header>`);
  lines.push(`    <AuditFileVersion>1.30</AuditFileVersion>`);
  lines.push(`    <AuditFileCountry>NO</AuditFileCountry>`);
  lines.push(`    <AuditFileDateCreated>${datoCreated}</AuditFileDateCreated>`);
  lines.push(`    <SoftwareCompanyName>KETL</SoftwareCompanyName>`);
  lines.push(`    <SoftwareID>KETL Regnskap</SoftwareID>`);
  lines.push(`    <SoftwareVersion>1.0</SoftwareVersion>`);
  lines.push(`    <Company>`);
  lines.push(`      <RegistrationNumber>${xmlEsc(klient.orgnr)}</RegistrationNumber>`);
  lines.push(`      <Name>${xmlEsc(klient.navn)}</Name>`);
  lines.push(`      <Address>`);
  lines.push(`        <StreetName>${xmlEsc(klient.adresse ?? "")}</StreetName>`);
  lines.push(`        <Country>NO</Country>`);
  lines.push(`      </Address>`);
  lines.push(`      <Contact>`);
  lines.push(`        <ContactPerson>`);
  lines.push(`          <FirstName>${xmlEsc(klient.kontaktperson.split(" ")[0] ?? "")}</FirstName>`);
  lines.push(`          <LastName>${xmlEsc(klient.kontaktperson.split(" ").slice(1).join(" ") || "-")}</LastName>`);
  lines.push(`        </ContactPerson>`);
  lines.push(`        <Telephone>${xmlEsc(klient.telefon ?? "")}</Telephone>`);
  lines.push(`        <Email>${xmlEsc(klient.epost)}</Email>`);
  lines.push(`      </Contact>`);
  lines.push(`    </Company>`);
  lines.push(`    <DefaultCurrencyCode>NOK</DefaultCurrencyCode>`);
  lines.push(`    <SelectionCriteria>`);
  lines.push(`      <PeriodStart>${startMnd}</PeriodStart>`);
  lines.push(`      <PeriodStartYear>${startÅr}</PeriodStartYear>`);
  lines.push(`      <PeriodEnd>${sluttMnd}</PeriodEnd>`);
  lines.push(`      <PeriodEndYear>${sluttÅr}</PeriodEndYear>`);
  lines.push(`    </SelectionCriteria>`);
  lines.push(`    <TaxAccountingBasis>I</TaxAccountingBasis>`);
  lines.push(`  </Header>`);

  // ── MasterFiles ─────────────────────────────────────────────────────────────
  lines.push(`  <MasterFiles>`);

  // Kontoplan — bare brukte kontoer
  lines.push(`    <GeneralLedgerAccounts>`);
  for (const kontonr of [...brukteKontoer].sort()) {
    const konto = NS4102_KONTOPLAN.find((k) => k.nummer === kontonr);
    const kontoNavn = konto?.navn ?? kontonr;
    const accountType = kontonr[0] === "1" ? "Asset"
      : kontonr[0] === "2" ? "Liability"
      : kontonr[0] === "3" ? "Revenue"
      : "Expense";
    lines.push(`      <Account>`);
    lines.push(`        <AccountID>${xmlEsc(kontonr)}</AccountID>`);
    lines.push(`        <AccountDescription>${xmlEsc(kontoNavn)}</AccountDescription>`);
    lines.push(`        <AccountType>${accountType}</AccountType>`);
    if (konto?.mvaKode) {
      lines.push(`        <TaxCode>${xmlEsc(konto.mvaKode)}</TaxCode>`);
    }
    lines.push(`      </Account>`);
  }
  lines.push(`    </GeneralLedgerAccounts>`);

  // MVA-tabell
  lines.push(`    <TaxTable>`);
  const vanligeMvaSatser = [
    { kode: "1",  beskrivelse: "Inngående MVA 25%",  sats: "25.00", type: "MVA" },
    { kode: "3",  beskrivelse: "Utgående MVA 25%",   sats: "25.00", type: "MVA" },
    { kode: "5",  beskrivelse: "Utgående MVA 15%",   sats: "15.00", type: "MVA" },
    { kode: "6",  beskrivelse: "Utgående MVA 12%",   sats: "12.00", type: "MVA" },
    { kode: "11", beskrivelse: "Inngående MVA 15%",  sats: "15.00", type: "MVA" },
    { kode: "12", beskrivelse: "Inngående MVA 12%",  sats: "12.00", type: "MVA" },
    { kode: "0",  beskrivelse: "Unntatt MVA / 0%",   sats: "0.00",  type: "MVA" },
  ];
  for (const mva of vanligeMvaSatser) {
    lines.push(`      <TaxTableEntry>`);
    lines.push(`        <TaxType>MVA</TaxType>`);
    lines.push(`        <TaxCode>${mva.kode}</TaxCode>`);
    lines.push(`        <TaxDescription>${mva.beskrivelse}</TaxDescription>`);
    lines.push(`        <TaxPercentage>${mva.sats}</TaxPercentage>`);
    lines.push(`      </TaxTableEntry>`);
  }
  lines.push(`    </TaxTable>`);

  lines.push(`  </MasterFiles>`);

  // ── GeneralLedgerEntries ────────────────────────────────────────────────────
  lines.push(`  <GeneralLedgerEntries>`);
  lines.push(`    <NumberOfEntries>${bokførteBilag.length}</NumberOfEntries>`);
  lines.push(`    <TotalDebit>${saftBeløp(totalDebet)}</TotalDebit>`);
  lines.push(`    <TotalCredit>${saftBeløp(totalKredit)}</TotalCredit>`);
  lines.push(`    <Journal>`);
  lines.push(`      <JournalID>1</JournalID>`);
  lines.push(`      <Description>Generell dagbok</Description>`);
  lines.push(`      <Type>G</Type>`);

  for (const b of bokførteBilag) {
    const periode = månedNr(b.dato);
    const år = årNr(b.dato);
    lines.push(`      <Transaction>`);
    lines.push(`        <TransactionID>${b.bilagsnr}</TransactionID>`);
    lines.push(`        <Period>${String(periode).padStart(2, "0")}</Period>`);
    lines.push(`        <PeriodYear>${år}</PeriodYear>`);
    lines.push(`        <TransactionDate>${b.dato}</TransactionDate>`);
    lines.push(`        <Description>${xmlEsc(b.beskrivelse)}</Description>`);
    lines.push(`        <SystemEntryDate>${b.dato}</SystemEntryDate>`);

    let linjNr = 1;
    for (const p of b.posteringer) {
      lines.push(`        <Line>`);
      lines.push(`          <RecordID>${linjNr++}</RecordID>`);
      lines.push(`          <AccountID>${xmlEsc(p.kontonr)}</AccountID>`);
      lines.push(`          <Description>${xmlEsc(p.beskrivelse ?? b.beskrivelse)}</Description>`);
      if ((p.debet ?? 0) > 0) {
        lines.push(`          <DebitAmount>`);
        lines.push(`            <Amount>${saftBeløp(p.debet)}</Amount>`);
        lines.push(`          </DebitAmount>`);
      }
      if ((p.kredit ?? 0) > 0) {
        lines.push(`          <CreditAmount>`);
        lines.push(`            <Amount>${saftBeløp(p.kredit)}</Amount>`);
        lines.push(`          </CreditAmount>`);
      }
      if (p.mvaKode && p.mvaKode !== "0") {
        const mvaInfo = finnMvaKode(p.mvaKode);
        const mvaGrunnlag = Math.max(p.debet ?? 0, p.kredit ?? 0);
        const mvaSats = mvaInfo?.sats ?? 25;
        const mvaBeløp = mvaGrunnlag * (mvaSats / (100 + mvaSats));
        lines.push(`          <TaxInformation>`);
        lines.push(`            <TaxType>MVA</TaxType>`);
        lines.push(`            <TaxCode>${xmlEsc(p.mvaKode)}</TaxCode>`);
        lines.push(`            <TaxPercentage>${mvaSats}.00</TaxPercentage>`);
        lines.push(`            <TaxBase>${saftBeløp(mvaGrunnlag - mvaBeløp)}</TaxBase>`);
        lines.push(`            <TaxAmount>`);
        lines.push(`              <Amount>${saftBeløp(mvaBeløp)}</Amount>`);
        lines.push(`            </TaxAmount>`);
        lines.push(`          </TaxInformation>`);
      }
      lines.push(`        </Line>`);
    }

    lines.push(`      </Transaction>`);
  }

  lines.push(`    </Journal>`);
  lines.push(`  </GeneralLedgerEntries>`);
  lines.push(`</AuditFile>`);

  return lines.join("\n");
}

/**
 * Generer SAF-T XML og last ned som fil i nettleseren.
 * Filnavn: SAF-T_Financial_{orgnr}_{dato}_001.xml
 */
export function lastNedSaftXml(valg: SaftEksportValg): void {
  const xml = genererSaftXml(valg);
  const dato = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const orgnr = valg.klient.orgnr.replace(/\s/g, "");
  const filnavn = `SAF-T_Financial_${orgnr}_${dato}_001.xml`;

  const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filnavn;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Beregn antall bilag og periodeinfo for SAF-T-visning */
export function saftMetadata(bilag: (Bilag & { id: string })[]) {
  const bokførte = bilag.filter((b) => b.status === "bokført" || b.status === "kreditert");
  const datoer = bokførte.map((b) => b.dato).sort();
  return {
    antallBilag: bokførte.length,
    antallPosteringer: bokførte.reduce((s, b) => s + b.posteringer.length, 0),
    periodeStart: datoer[0],
    periodeSlutt: datoer[datoer.length - 1],
  };
}
