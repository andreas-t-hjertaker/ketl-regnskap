"use client";

/**
 * Hovedbok (#129) — Bokføringsloven § 5
 *
 * Komplett posteringshistorikk per konto med:
 * - Kontovalg fra kontoplan (alle kontoer med posteringer)
 * - Kronologisk liste: dato, bilagsnr, beskrivelse, debet, kredit, løpende saldo
 * - IB (inngående balanse) og UB (utgående balanse) per periode
 * - Periode- og fritekstfiltrering
 * - Drill-down: klikk på rad → åpner bilag i bilagssiden
 * - CSV-eksport
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BookMarked,
  Download,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useAktivKlient } from "@/hooks/use-aktiv-klient";
import { useBilag } from "@/hooks/use-bilag";
import type { BilagMedId } from "@/hooks/use-bilag";
import { NS4102_KONTOPLAN } from "@/lib/kontoplan";

// ─── Types ────────────────────────────────────────────────────────────────────

type HovedbokLinje = {
  bilagId: string;
  bilagsnr: number;
  dato: string;
  beskrivelse: string;
  debet: number;
  kredit: number;
  saldo: number;
};

type KontoMedData = {
  kontonr: string;
  kontonavn: string;
  antallLinjer: number;
  ib: number;     // Inngående balanse for valgt periode
  ub: number;     // Utgående balanse for valgt periode
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formaterNOK(v: number): string {
  return new Intl.NumberFormat("nb-NO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
}

function sisteNMåneder(n = 24): string[] {
  const måneder: string[] = [];
  const nå = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(nå.getFullYear(), nå.getMonth() - i, 1);
    måneder.push(d.toISOString().slice(0, 7));
  }
  return måneder;
}

function lastNedCsvFil(innhold: string, filnavn: string) {
  const blob = new Blob(["\uFEFF" + innhold], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filnavn;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Beregn kontoer og posteringslinjer fra bilag ─────────────────────────────

function byggHovedbokData(
  bilag: BilagMedId[],
  periode: string | null
): { kontoer: KontoMedData[]; posteringerPerKonto: Map<string, HovedbokLinje[]> } {
  const posteringerPerKonto = new Map<string, HovedbokLinje[]>();
  const kontonavn = new Map<string, string>();

  // Saml alle posteringer fra bokførte/krediterte bilag
  const relevante = bilag.filter(
    (b) => b.status === "bokført" || b.status === "kreditert"
  );

  for (const b of relevante) {
    for (const p of b.posteringer) {
      const nr = p.kontonr;
      if (!kontonavn.has(nr)) {
        // Bruk navn fra bilag, fallback til NS4102
        const fraKontoplan = NS4102_KONTOPLAN.find((k) => k.nummer === nr);
        kontonavn.set(nr, p.kontonavn || fraKontoplan?.navn || nr);
      }
      const linjer = posteringerPerKonto.get(nr) ?? [];
      linjer.push({
        bilagId: b.id,
        bilagsnr: b.bilagsnr,
        dato: b.dato,
        beskrivelse: b.beskrivelse,
        debet: p.debet ?? 0,
        kredit: p.kredit ?? 0,
        saldo: 0, // beregnes under
      });
      posteringerPerKonto.set(nr, linjer);
    }
  }

  // Bygg kontoer med IB, UB og løpende saldo
  const kontoer: KontoMedData[] = [];

  for (const [nr, linjer] of posteringerPerKonto.entries()) {
    // Sorter kronologisk (dato, deretter bilagsnr)
    linjer.sort((a, b) =>
      a.dato < b.dato ? -1 : a.dato > b.dato ? 1 : a.bilagsnr - b.bilagsnr
    );

    // IB = sum av alle posteringer FØR periodens start
    let ib = 0;
    if (periode) {
      const periodeFra = periode + "-01";
      for (const l of linjer) {
        if (l.dato < periodeFra) {
          ib += l.debet - l.kredit;
        }
      }
    }

    // Filtrer til periode
    const filtrert = periode
      ? linjer.filter((l) => l.dato.startsWith(periode))
      : linjer;

    // Løpende saldo
    let saldo = ib;
    for (const l of filtrert) {
      saldo += l.debet - l.kredit;
      l.saldo = saldo;
    }

    const ub = saldo;

    kontoer.push({
      kontonr: nr,
      kontonavn: kontonavn.get(nr) ?? nr,
      antallLinjer: filtrert.length,
      ib,
      ub,
    });

    // Oppdater listen med kun filtrerte linjer
    posteringerPerKonto.set(nr, filtrert);
  }

  // Sorter kontoer etter kontonummer
  kontoer.sort((a, b) => a.kontonr.localeCompare(b.kontonr));

  return { kontoer, posteringerPerKonto };
}

// ─── Side ─────────────────────────────────────────────────────────────────────

export default function HovedbokPage() {
  const { user } = useAuth();
  const { aktivKlient } = useAktivKlient();
  const { bilag, loading } = useBilag(user?.uid ?? null, aktivKlient?.id);

  const [valgtKonto, setValgtKonto] = useState<string | null>(null);
  const [valgtPeriode, setValgtPeriode] = useState<string>("");
  const [søk, setSøk] = useState("");
  const [sortRetning, setSortRetning] = useState<"asc" | "desc">("asc");

  const måneder = useMemo(() => sisteNMåneder(36), []);

  const { kontoer, posteringerPerKonto } = useMemo(
    () => byggHovedbokData(bilag, valgtPeriode || null),
    [bilag, valgtPeriode]
  );

  const filtrerteKontoer = useMemo(() => {
    if (!søk) return kontoer;
    const s = søk.toLowerCase();
    return kontoer.filter(
      (k) =>
        k.kontonr.includes(s) || k.kontonavn.toLowerCase().includes(s)
    );
  }, [kontoer, søk]);

  const aktivKontoData = valgtKonto ? posteringerPerKonto.get(valgtKonto) ?? [] : [];
  const aktivKontoInfo = kontoer.find((k) => k.kontonr === valgtKonto);

  const sorterteLinjer = useMemo(() => {
    const kopi = [...aktivKontoData];
    if (sortRetning === "desc") kopi.reverse();
    return kopi;
  }, [aktivKontoData, sortRetning]);

  function eksporterCsv() {
    if (!valgtKonto || aktivKontoData.length === 0) return;
    const headers = ["Dato", "Bilagsnr", "Beskrivelse", "Debet", "Kredit", "Saldo"];
    const rader = aktivKontoData.map((l) => [
      l.dato,
      l.bilagsnr.toString(),
      l.beskrivelse,
      l.debet.toFixed(2),
      l.kredit.toFixed(2),
      l.saldo.toFixed(2),
    ]);
    const csv = [headers, ...rader]
      .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const suffix = valgtPeriode || "alt";
    lastNedCsvFil(csv, `hovedbok_${valgtKonto}_${suffix}.csv`);
  }

  if (!aktivKlient) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Velg en klient for å se hovedbok.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookMarked className="h-6 w-6" />
            Hovedbok
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Kronologisk oversikt over alle posteringer per konto — Bokføringsloven § 5
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Periode-velger */}
          <select
            value={valgtPeriode}
            onChange={(e) => { setValgtPeriode(e.target.value); setValgtKonto(null); }}
            className="rounded-md border bg-background px-3 py-2 text-sm w-44"
          >
            <option value="">Alle perioder</option>
            {måneder.map((m) => (
              <option key={m} value={m}>
                {new Date(m + "-01").toLocaleDateString("nb-NO", {
                  month: "long",
                  year: "numeric",
                })}
              </option>
            ))}
          </select>

          {valgtKonto && (
            <Button variant="outline" size="sm" onClick={eksporterCsv}>
              <Download className="h-4 w-4 mr-1" />
              Eksporter CSV
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Konto-liste (venstre kolonne) */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Søk kontonr. eller navn…"
              value={søk}
              onChange={(e) => setSøk(e.target.value)}
              className="pl-9"
            />
          </div>

          <Card className="overflow-hidden">
            <CardHeader className="py-3 px-4 border-b">
              <CardTitle className="text-sm font-medium">
                {loading ? "Laster…" : `${filtrerteKontoer.length} kontoer`}
              </CardTitle>
            </CardHeader>
            <div className="max-h-[60vh] overflow-y-auto">
              {loading ? (
                <div className="p-3 space-y-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : filtrerteKontoer.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8 px-4">
                  Ingen bokførte posteringer funnet.
                </p>
              ) : (
                filtrerteKontoer.map((k) => (
                  <button
                    key={k.kontonr}
                    onClick={() => setValgtKonto(k.kontonr)}
                    className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors border-b last:border-b-0 ${
                      valgtKonto === k.kontonr ? "bg-muted" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono text-xs text-muted-foreground">{k.kontonr}</p>
                        <p className="text-sm font-medium truncate">{k.kontonavn}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-xs font-medium ${k.ub >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                          {formaterNOK(k.ub)}
                        </p>
                        <p className="text-xs text-muted-foreground">{k.antallLinjer} linjer</p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Posteringshistorikk (høyre kolonne) */}
        <div>
          {!valgtKonto ? (
            <Card className="flex items-center justify-center h-64">
              <p className="text-muted-foreground text-sm">
                Velg en konto til venstre for å se posteringshistorikk.
              </p>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <CardTitle className="text-base">
                      {valgtKonto} — {aktivKontoInfo?.kontonavn}
                    </CardTitle>
                    <CardDescription className="mt-1 space-x-4">
                      <span>IB: <strong>{formaterNOK(aktivKontoInfo?.ib ?? 0)}</strong></span>
                      <span>UB: <strong>{formaterNOK(aktivKontoInfo?.ub ?? 0)}</strong></span>
                      <span>{aktivKontoData.length} posteringer</span>
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSortRetning(s => s === "asc" ? "desc" : "asc")}
                    className="text-xs"
                  >
                    Dato {sortRetning === "asc"
                      ? <ChevronUp className="h-3 w-3 ml-1" />
                      : <ChevronDown className="h-3 w-3 ml-1" />}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {aktivKontoData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Ingen posteringer for valgt periode.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b bg-muted/50">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium text-xs text-muted-foreground w-24">Dato</th>
                          <th className="px-4 py-2 text-left font-medium text-xs text-muted-foreground w-16">Bilagsnr</th>
                          <th className="px-4 py-2 text-left font-medium text-xs text-muted-foreground">Beskrivelse</th>
                          <th className="px-4 py-2 text-right font-medium text-xs text-muted-foreground w-28">Debet</th>
                          <th className="px-4 py-2 text-right font-medium text-xs text-muted-foreground w-28">Kredit</th>
                          <th className="px-4 py-2 text-right font-medium text-xs text-muted-foreground w-32">Saldo</th>
                          <th className="px-4 py-2 w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {sorterteLinjer.map((linje, i) => (
                          <tr
                            key={`${linje.bilagId}-${i}`}
                            className="border-b last:border-b-0 hover:bg-muted/30 transition-colors"
                          >
                            <td className="px-4 py-2 font-mono text-xs text-muted-foreground whitespace-nowrap">
                              {linje.dato}
                            </td>
                            <td className="px-4 py-2 font-mono text-xs">
                              <Badge variant="outline" className="text-xs">
                                #{linje.bilagsnr}
                              </Badge>
                            </td>
                            <td className="px-4 py-2 max-w-xs truncate text-xs">
                              {linje.beskrivelse}
                            </td>
                            <td className="px-4 py-2 text-right font-mono text-xs">
                              {linje.debet > 0 ? formaterNOK(linje.debet) : ""}
                            </td>
                            <td className="px-4 py-2 text-right font-mono text-xs">
                              {linje.kredit > 0 ? formaterNOK(linje.kredit) : ""}
                            </td>
                            <td
                              className={`px-4 py-2 text-right font-mono text-xs font-medium ${
                                linje.saldo < 0 ? "text-destructive" : ""
                              }`}
                            >
                              {formaterNOK(linje.saldo)}
                            </td>
                            <td className="px-2 py-2">
                              <Link
                                href={`/dashboard/bilag?id=${linje.bilagId}`}
                                className="inline-flex items-center justify-center h-6 w-6 rounded hover:bg-muted"
                                title="Åpne bilag"
                              >
                                <ExternalLink className="h-3 w-3 text-muted-foreground" />
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      {/* Summer-rad */}
                      <tfoot className="bg-muted/50 border-t-2">
                        <tr>
                          <td colSpan={3} className="px-4 py-2 text-xs font-semibold">
                            Sum {valgtPeriode ? `(${valgtPeriode})` : "(alle perioder)"}
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-xs font-semibold">
                            {formaterNOK(aktivKontoData.reduce((s, l) => s + l.debet, 0))}
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-xs font-semibold">
                            {formaterNOK(aktivKontoData.reduce((s, l) => s + l.kredit, 0))}
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-xs font-semibold">
                            {formaterNOK(aktivKontoInfo?.ub ?? 0)}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
