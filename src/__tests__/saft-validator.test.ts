/**
 * Tester for SAF-T XML-validering
 *
 * validerSaftXml er en ren funksjon som sjekker SAF-T Financial 1.30 XML.
 * Dekker alle 8 valideringsregler implementert i saft-eksport.ts.
 */

import { describe, it, expect } from "vitest";
import { validerSaftXml } from "@/lib/saft-eksport";

// ─── Minimal gyldig SAF-T XML ─────────────────────────────────────────────────

const MINIMAL_GYLDIG_XML = `<?xml version="1.0" encoding="UTF-8"?>
<AuditFile xmlns="urn:StandardAuditFile-Taxation-Financial:NO"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="urn:StandardAuditFile-Taxation-Financial:NO SAF-T_Financial_Version_1.30.xsd">
  <Header>
    <AuditFileVersion>1.30</AuditFileVersion>
    <AuditFileCountry>NO</AuditFileCountry>
    <AuditFileDateCreated>2026-03-23</AuditFileDateCreated>
    <SoftwareID>ketl regnskap</SoftwareID>
    <Company>
      <RegistrationNumber>123456789</RegistrationNumber>
    </Company>
    <SelectionCriteria>
      <PeriodStart>2026-01-01</PeriodStart>
    </SelectionCriteria>
  </Header>
  <MasterFiles>
    <GeneralLedgerAccounts>
      <Account>
        <AccountID>3000</AccountID>
      </Account>
    </GeneralLedgerAccounts>
  </MasterFiles>
  <GeneralLedgerEntries>
    <Journal>
      <Transaction>
        <Line>
          <DebitAmount><Amount>1000.00</Amount></DebitAmount>
        </Line>
        <Line>
          <CreditAmount><Amount>1000.00</Amount></CreditAmount>
        </Line>
      </Transaction>
    </Journal>
  </GeneralLedgerEntries>
</AuditFile>`;

// ─── validerSaftXml ───────────────────────────────────────────────────────────

describe("validerSaftXml", () => {
  it("godkjenner minimal gyldig SAF-T 1.30 XML", () => {
    const resultat = validerSaftXml(MINIMAL_GYLDIG_XML);
    expect(resultat.gyldig).toBe(true);
    expect(resultat.funn.filter((f) => f.alvorlighet === "feil")).toHaveLength(0);
  });

  it("rapporterer feil for XML som mangler Transaction-element", () => {
    // Fjern Transaction-elementet — dette er påkrevd iht. valideringen
    const xml = MINIMAL_GYLDIG_XML.replace("<Transaction>", "<!-- fjernet -->").replace("</Transaction>", "");
    const resultat = validerSaftXml(xml);
    expect(resultat.gyldig).toBe(false);
    const feil = resultat.funn.filter((f) => f.alvorlighet === "feil");
    expect(feil.some((f) => f.beskrivelse.toLowerCase().includes("transaction"))).toBe(true);
  });

  it("rapporterer feil for XML som mangler Header", () => {
    const xml = MINIMAL_GYLDIG_XML.replace("<Header>", "<!-- HEADER FJERNET -->");
    const resultat = validerSaftXml(xml);
    expect(resultat.gyldig).toBe(false);
    const feil = resultat.funn.filter((f) => f.alvorlighet === "feil");
    expect(feil.some((f) => f.beskrivelse.includes("Header"))).toBe(true);
  });

  it("rapporterer advarsel for feil AuditFileVersion", () => {
    const xml = MINIMAL_GYLDIG_XML.replace("<AuditFileVersion>1.30</AuditFileVersion>",
      "<AuditFileVersion>1.10</AuditFileVersion>");
    const resultat = validerSaftXml(xml);
    const advarsler = resultat.funn.filter((f) => f.alvorlighet === "advarsel");
    expect(advarsler.some((f) => f.beskrivelse.includes("1.10"))).toBe(true);
  });

  it("rapporterer OK for korrekt AuditFileVersion 1.30", () => {
    const resultat = validerSaftXml(MINIMAL_GYLDIG_XML);
    const ok = resultat.funn.filter((f) => f.alvorlighet === "ok");
    expect(ok.some((f) => f.beskrivelse.includes("1.30"))).toBe(true);
  });

  it("rapporterer advarsel for manglende landkode NO", () => {
    const xml = MINIMAL_GYLDIG_XML.replace("<AuditFileCountry>NO</AuditFileCountry>",
      "<AuditFileCountry>SE</AuditFileCountry>");
    const resultat = validerSaftXml(xml);
    const advarsler = resultat.funn.filter((f) => f.alvorlighet === "advarsel");
    expect(advarsler.some((f) => f.beskrivelse.toLowerCase().includes("country"))).toBe(true);
  });

  it("rapporterer OK for landkode NO", () => {
    const resultat = validerSaftXml(MINIMAL_GYLDIG_XML);
    const ok = resultat.funn.filter((f) => f.alvorlighet === "ok");
    expect(ok.some((f) => f.beskrivelse.includes("NO"))).toBe(true);
  });

  it("rapporterer feil for ugyldig datoformat i AuditFileDateCreated", () => {
    const xml = MINIMAL_GYLDIG_XML.replace(
      "<AuditFileDateCreated>2026-03-23</AuditFileDateCreated>",
      "<AuditFileDateCreated>23/03/2026</AuditFileDateCreated>"
    );
    const resultat = validerSaftXml(xml);
    const feil = resultat.funn.filter((f) => f.alvorlighet === "feil");
    expect(feil.some((f) => f.beskrivelse.includes("AuditFileDateCreated"))).toBe(true);
  });

  it("rapporterer OK for balanserte transaksjoner (debet = kredit)", () => {
    const resultat = validerSaftXml(MINIMAL_GYLDIG_XML);
    const ok = resultat.funn.filter((f) => f.alvorlighet === "ok");
    expect(ok.some((f) => f.beskrivelse.includes("balanse"))).toBe(true);
  });

  it("rapporterer feil for ubalansert transaksjon", () => {
    const xml = MINIMAL_GYLDIG_XML.replace(
      "<DebitAmount><Amount>1000.00</Amount></DebitAmount>",
      "<DebitAmount><Amount>1500.00</Amount></DebitAmount>"
    );
    const resultat = validerSaftXml(xml);
    const feil = resultat.funn.filter((f) => f.alvorlighet === "feil");
    expect(feil.some((f) => f.beskrivelse.includes("balanse"))).toBe(true);
  });

  it("rapporterer antall kontoer OK når kontoer er registrert", () => {
    const resultat = validerSaftXml(MINIMAL_GYLDIG_XML);
    const ok = resultat.funn.filter((f) => f.alvorlighet === "ok");
    expect(ok.some((f) => f.beskrivelse.includes("kontoer"))).toBe(true);
  });

  it("rapporterer OK for UTF-8 XML-deklarasjon", () => {
    const resultat = validerSaftXml(MINIMAL_GYLDIG_XML);
    const ok = resultat.funn.filter((f) => f.alvorlighet === "ok");
    expect(ok.some((f) => f.beskrivelse.includes("UTF-8"))).toBe(true);
  });

  it("rapporterer advarsel for manglende UTF-8 XML-deklarasjon", () => {
    const xml = MINIMAL_GYLDIG_XML.replace('<?xml version="1.0" encoding="UTF-8"?>', "");
    const resultat = validerSaftXml(xml);
    const advarsler = resultat.funn.filter((f) => f.alvorlighet === "advarsel");
    expect(advarsler.some((f) => f.beskrivelse.includes("UTF-8"))).toBe(true);
  });

  it("rapporterer OK for korrekt XSD-referanse", () => {
    const resultat = validerSaftXml(MINIMAL_GYLDIG_XML);
    const ok = resultat.funn.filter((f) => f.alvorlighet === "ok");
    expect(ok.some((f) => f.beskrivelse.includes("XSD"))).toBe(true);
  });
});
