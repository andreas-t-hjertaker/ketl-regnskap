"use client";

/**
 * Lønnsseddel-generator
 *
 * Genererer lønnsseddler (payslips) for ansatte basert på
 * registrerte lønnsutbetalinger fra A-meldingssystemet.
 *
 * Støtter:
 * - Søk og filter på ansatt og måned
 * - Utskrift til PDF via browser print-dialog
 * - Ferdig formatert med alle lovpålagte felt (ftrl. § 14-15)
 */

import { useState, useMemo, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Printer,
  Users,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SlideIn } from "@/components/motion";
import { useAuth } from "@/hooks/use-auth";
import { useAktivKlient } from "@/hooks/use-aktiv-klient";
import { useAnsatte, useLonnsUtbetalinger } from "@/hooks/use-amelding";
import type { LonnsUtbetalingMedId, AnsattMedId } from "@/hooks/use-amelding";

// ─── Hjelpefunksjoner ─────────────────────────────────────────────────────────

function fmtKr(beløp: number): string {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(beløp);
}

function fmtDato(iso: string): string {
  return new Intl.DateTimeFormat("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

function fmtMåned(yyyyMm: string): string {
  return new Intl.DateTimeFormat("nb-NO", {
    month: "long",
    year: "numeric",
  }).format(new Date(yyyyMm + "-01"));
}

function nåværendeMåned(): string {
  return new Date().toISOString().slice(0, 7);
}

function forrigeMåned(yyyyMm: string): string {
  const [år, mnd] = yyyyMm.split("-").map(Number);
  const d = new Date(år, mnd - 2, 1);
  return d.toISOString().slice(0, 7);
}

function nesteMåned(yyyyMm: string): string {
  const [år, mnd] = yyyyMm.split("-").map(Number);
  const d = new Date(år, mnd, 1);
  return d.toISOString().slice(0, 7);
}

const INNTEKTSTYPE_ETIKETT: Record<string, string> = {
  fastloenn: "Fast lønn",
  timeloenn: "Timelønn",
  overtidsgodtjoerelse: "Overtidsgodtgjørelse",
  bonus: "Bonus",
  feriepenger: "Feriepenger",
  sykepenger: "Sykepenger",
};

// ─── LønnsslippDokument ───────────────────────────────────────────────────────

function LønnsslippDokument({
  utbetaling,
  ansatt,
  klientNavn,
}: {
  utbetaling: LonnsUtbetalingMedId;
  ansatt: AnsattMedId;
  klientNavn: string;
}) {
  const nettoLønn =
    utbetaling.bruttoLonn - utbetaling.skattetrekk;
  const aga = utbetaling.arbeidsgiveravgift ?? 0;

  return (
    <div className="bg-white text-black p-8 rounded-lg border shadow-sm print:shadow-none print:border-0 font-sans text-sm">
      {/* Topplinje */}
      <div className="flex items-start justify-between border-b pb-4 mb-6">
        <div>
          <h1 className="text-lg font-bold uppercase tracking-wide">Lønnsseddel</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Periode: {fmtMåned(utbetaling.kalendermaaned)}
          </p>
        </div>
        <div className="text-right">
          <p className="font-semibold">{klientNavn}</p>
          <p className="text-xs text-gray-500">Arbeidsgiver</p>
        </div>
      </div>

      {/* Ansattinformasjon */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Ansatt
          </p>
          <table className="w-full text-xs">
            <tbody className="space-y-1">
              <tr>
                <td className="text-gray-500 pr-4 py-0.5">Navn</td>
                <td className="font-medium">{ansatt.navn}</td>
              </tr>
              <tr>
                <td className="text-gray-500 pr-4 py-0.5">Fødselsnummer</td>
                <td className="font-mono">
                  {ansatt.fnr.slice(0, 6)}*****
                </td>
              </tr>
              <tr>
                <td className="text-gray-500 pr-4 py-0.5">Arbeidsforhold-ID</td>
                <td className="font-mono text-xs">{ansatt.arbeidsforholdId}</td>
              </tr>
              <tr>
                <td className="text-gray-500 pr-4 py-0.5">Stillingsprosent</td>
                <td>{ansatt.stillingsprosent} %</td>
              </tr>
              <tr>
                <td className="text-gray-500 pr-4 py-0.5">Skattekommune</td>
                <td>{ansatt.skattekommune}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Utbetaling
          </p>
          <table className="w-full text-xs">
            <tbody>
              <tr>
                <td className="text-gray-500 pr-4 py-0.5">Opptjening fra</td>
                <td>{fmtDato(utbetaling.opptjeningFra)}</td>
              </tr>
              <tr>
                <td className="text-gray-500 pr-4 py-0.5">Opptjening til</td>
                <td>{fmtDato(utbetaling.opptjeningTil)}</td>
              </tr>
              <tr>
                <td className="text-gray-500 pr-4 py-0.5">Utbetalt dato</td>
                <td className="font-medium">{fmtDato(utbetaling.utbetaltDato)}</td>
              </tr>
              <tr>
                <td className="text-gray-500 pr-4 py-0.5">Inntektstype</td>
                <td>{INNTEKTSTYPE_ETIKETT[utbetaling.inntektsBeskrivelse] ?? utbetaling.inntektsBeskrivelse}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Lønnsberegning */}
      <div className="border rounded-lg overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-gray-600">Beskrivelse</th>
              <th className="px-4 py-2 text-right font-medium text-gray-600">Beløp (NOK)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="px-4 py-2">
                {INNTEKTSTYPE_ETIKETT[utbetaling.inntektsBeskrivelse] ?? "Lønn"}
              </td>
              <td className="px-4 py-2 text-right font-mono">
                {fmtKr(utbetaling.bruttoLonn)}
              </td>
            </tr>
            <tr className="border-b bg-red-50/30">
              <td className="px-4 py-2 text-gray-600">− Skattetrekk</td>
              <td className="px-4 py-2 text-right font-mono text-red-700">
                − {fmtKr(utbetaling.skattetrekk)}
              </td>
            </tr>
            <tr className="bg-green-50/40 font-semibold border-t-2">
              <td className="px-4 py-3">Netto til utbetaling</td>
              <td className="px-4 py-3 text-right font-mono text-green-800">
                {fmtKr(nettoLønn)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Arbeidsgiveravgift (informasjon) */}
      {aga > 0 && (
        <div className="rounded-lg bg-gray-50 px-4 py-3 text-xs text-gray-600 mb-4">
          <span className="font-medium">Arbeidsgiveravgift (AGA): </span>
          {fmtKr(aga)} — betales av arbeidsgiver, trekkes ikke fra lønnen din.
        </div>
      )}

      {/* Bunntekst */}
      <div className="border-t pt-4 mt-4 text-xs text-gray-400 flex items-center justify-between">
        <span>Generert av ketl regnskap · {new Date().toLocaleDateString("nb-NO")}</span>
        <span>
          Skattekommune: {ansatt.skattekommune} · Ftrl. § 14-15
        </span>
      </div>
    </div>
  );
}

// ─── Utskriftsknapp-wrapper ───────────────────────────────────────────────────

function UtskriftsPanel({
  utbetaling,
  ansatt,
  klientNavn,
}: {
  utbetaling: LonnsUtbetalingMedId;
  ansatt: AnsattMedId;
  klientNavn: string;
}) {
  const printRef = useRef<HTMLDivElement>(null);

  function skrivUt() {
    // Trigger browser print dialog — CSS @media print will hide everything else
    window.print();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-medium">{ansatt.navn}</p>
          <p className="text-xs text-muted-foreground">
            {fmtMåned(utbetaling.kalendermaaned)} · {fmtKr(utbetaling.bruttoLonn - utbetaling.skattetrekk)} netto
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={skrivUt}>
          <Printer className="h-3.5 w-3.5 mr-1.5" />
          Skriv ut / PDF
        </Button>
      </div>
      <div ref={printRef}>
        <LønnsslippDokument
          utbetaling={utbetaling}
          ansatt={ansatt}
          klientNavn={klientNavn}
        />
      </div>
    </div>
  );
}

// ─── Hovedside ────────────────────────────────────────────────────────────────

export default function LønnsslippPage() {
  const { user } = useAuth();
  const { aktivKlient } = useAktivKlient();
  const [valgtMåned, setValgtMåned] = useState(nåværendeMåned());
  const [søk, setSøk] = useState("");
  const [valgtAnsattId, setValgtAnsattId] = useState<string | null>(null);

  const { ansatte, loading: lasterAnsatte } = useAnsatte(
    user?.uid ?? null,
    aktivKlient?.id
  );

  const { utbetalinger, loading: lasterUtbetalinger } = useLonnsUtbetalinger(
    user?.uid ?? null,
    aktivKlient?.id,
    valgtMåned
  );

  const filtrertAnsatte = useMemo(
    () =>
      ansatte.filter((a) =>
        søk === "" || a.navn.toLowerCase().includes(søk.toLowerCase())
      ),
    [ansatte, søk]
  );

  const valgtAnsatt = ansatte.find((a) => a.id === valgtAnsattId) ?? null;
  const valgtUtbetaling = valgtAnsattId
    ? utbetalinger.find((u) => u.ansattId === valgtAnsattId) ?? null
    : null;

  if (!aktivKlient) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
        <Users className="h-10 w-10 opacity-30" />
        <p className="text-sm">Velg en klient i sidemenyen.</p>
      </div>
    );
  }

  return (
    <SlideIn>
      <div className="space-y-6 print:space-y-0">
        {/* Header (skjult ved utskrift) */}
        <div className="print:hidden">
          <Link
            href="/dashboard/amelding"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Tilbake til A-melding
          </Link>

          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold">Lønnsseddel</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Generer lønnsseddler for {aktivKlient.navn}
              </p>
            </div>

            {/* Månednavigasjon */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setValgtMåned(forrigeMåned(valgtMåned))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium w-36 text-center">
                {fmtMåned(valgtMåned)}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setValgtMåned(nesteMåned(valgtMåned))}
                disabled={valgtMåned >= nåværendeMåned()}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:block">
          {/* Ansattliste (skjult ved utskrift) */}
          <div className="print:hidden">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Ansatte</CardTitle>
                <CardDescription className="text-xs">
                  {utbetalinger.length} lønnsutbetalinger registrert for{" "}
                  {fmtMåned(valgtMåned)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 px-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    className="pl-8 h-8 text-xs"
                    placeholder="Søk ansatt…"
                    value={søk}
                    onChange={(e) => setSøk(e.target.value)}
                  />
                </div>

                {lasterAnsatte ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-12 w-full rounded-md" />
                    ))}
                  </div>
                ) : filtrertAnsatte.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    Ingen ansatte registrert.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {filtrertAnsatte.map((ansatt) => {
                      const harUtbetaling = utbetalinger.some(
                        (u) => u.ansattId === ansatt.id
                      );
                      const isValgt = valgtAnsattId === ansatt.id;
                      return (
                        <button
                          key={ansatt.id}
                          onClick={() =>
                            setValgtAnsattId(isValgt ? null : ansatt.id)
                          }
                          className={`w-full text-left rounded-md px-3 py-2 text-sm transition-colors ${
                            isValgt
                              ? "bg-accent text-accent-foreground"
                              : "hover:bg-accent/50"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{ansatt.navn}</span>
                            {harUtbetaling ? (
                              <Badge variant="default" className="text-xs h-4 px-1">
                                Utbetalt
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs h-4 px-1">
                                Ingen
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {ansatt.stillingsprosent} % · {ansatt.skattekommune}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Lønnsseddel-visning */}
          <div className="md:col-span-2">
            {lasterUtbetalinger ? (
              <Card>
                <CardContent className="p-6">
                  <Skeleton className="h-48 w-full rounded" />
                </CardContent>
              </Card>
            ) : !valgtAnsattId ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3 print:hidden">
                <Users className="h-10 w-10 opacity-30" />
                <p className="text-sm">Velg en ansatt til venstre for å vise lønnsseddelen.</p>
              </div>
            ) : !valgtUtbetaling ? (
              <Card className="print:hidden">
                <CardContent className="p-6 text-center text-muted-foreground text-sm">
                  <p>
                    Ingen lønnsutbetaling registrert for{" "}
                    <strong>{valgtAnsatt?.navn}</strong> i{" "}
                    {fmtMåned(valgtMåned)}.
                  </p>
                  <p className="mt-1 text-xs">
                    Gå til{" "}
                    <Link
                      href="/dashboard/amelding"
                      className="text-primary hover:underline"
                    >
                      A-melding
                    </Link>{" "}
                    for å registrere utbetaling.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <UtskriftsPanel
                utbetaling={valgtUtbetaling}
                ansatt={valgtAnsatt!}
                klientNavn={aktivKlient.navn}
              />
            )}
          </div>
        </div>
      </div>

      {/* Print-CSS */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print\\:block, .print\\:block * { visibility: visible; }
          .print\\:block { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </SlideIn>
  );
}
