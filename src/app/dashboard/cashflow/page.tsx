"use client";

/**
 * Cashflow-prognose — prediktiv analyse av likviditet (#39)
 *
 * Viser historisk cashflow og projisert likviditet basert på
 * glidende gjennomsnitt av inntekter/kostnader.
 */

import { useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  Banknote,
  ArrowRightLeft,
  ArrowDownRight,
  ArrowUpRight,
  FilePlus,
  AlertCircle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SlideIn, StaggerList, StaggerItem } from "@/components/motion";
import { useAuth } from "@/hooks/use-auth";
import { useAktivKlient } from "@/hooks/use-aktiv-klient";
import { useBilag } from "@/hooks/use-bilag";
import { useCashflow, type CashflowMåned } from "@/hooks/use-cashflow";
import { useFaktura } from "@/hooks/use-faktura";
import Link from "next/link";

// ─── Hjelpere ───────────────────────────────────────────────────────────────

function formatNOK(v: number) {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);
}

function formatKortNOK(v: number) {
  if (Math.abs(v) >= 1_000_000)
    return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000)
    return `${(v / 1_000).toFixed(0)}k`;
  return String(Math.round(v));
}

// ─── Inline cashflow-graf (bar chart med CSS) ───────────────────────────────

function CashflowBar({ måned, maxAbsVerdi }: { måned: CashflowMåned; maxAbsVerdi: number }) {
  const innPst = maxAbsVerdi > 0 ? (måned.innbetalinger / maxAbsVerdi) * 100 : 0;
  const utPst = maxAbsVerdi > 0 ? (måned.utbetalinger / maxAbsVerdi) * 100 : 0;

  return (
    <div className="flex flex-col items-center gap-1 min-w-[52px]">
      {/* Bar-container */}
      <div className="flex gap-0.5 h-24 items-end w-full">
        <div
          className={`flex-1 rounded-t ${
            måned.erPrognose ? "bg-green-400/40 border border-dashed border-green-500/40" : "bg-green-500/70"
          }`}
          style={{ height: `${innPst}%`, minHeight: innPst > 0 ? 2 : 0 }}
          title={`Innbetalinger: ${formatNOK(måned.innbetalinger)}`}
        />
        <div
          className={`flex-1 rounded-t ${
            måned.erPrognose ? "bg-red-400/40 border border-dashed border-red-500/40" : "bg-red-500/70"
          }`}
          style={{ height: `${utPst}%`, minHeight: utPst > 0 ? 2 : 0 }}
          title={`Utbetalinger: ${formatNOK(måned.utbetalinger)}`}
        />
      </div>
      {/* Label */}
      <span className={`text-[10px] ${måned.erPrognose ? "text-muted-foreground/60 italic" : "text-muted-foreground"}`}>
        {måned.label.split(" ")[0]}
      </span>
    </div>
  );
}

// ─── Hoved-side ─────────────────────────────────────────────────────────────

const MÅNEDSNAVN = [
  "jan", "feb", "mar", "apr", "mai", "jun",
  "jul", "aug", "sep", "okt", "nov", "des",
];

export default function CashflowPage() {
  const { user } = useAuth();
  const { aktivKlientId, aktivKlient } = useAktivKlient();
  const { bilag, loading } = useBilag(user?.uid ?? null, aktivKlientId);
  const { fakturaer } = useFaktura(user?.uid ?? null, aktivKlientId);
  const cashflow = useCashflow(bilag, 6);

  const maxAbsVerdi = useMemo(
    () =>
      Math.max(
        ...cashflow.måneder.map((m) => Math.max(m.innbetalinger, m.utbetalinger)),
        1
      ),
    [cashflow.måneder]
  );

  const sistHistorisk = cashflow.måneder.filter((m) => !m.erPrognose).at(-1);
  const sistePrognose = cashflow.måneder.at(-1);

  // Utestående fakturaer gruppert per forfallsmåned
  const forventedeFakturaer = useMemo(() => {
    const aktive = fakturaer.filter(
      (f) => f.status === "sendt" || f.status === "forfalt"
    );
    const perMåned = new Map<string, { sumInkMva: number; antall: number; forfalte: number }>();
    for (const f of aktive) {
      const mnd = f.forfallsDato.slice(0, 7);
      const existing = perMåned.get(mnd) ?? { sumInkMva: 0, antall: 0, forfalte: 0 };
      existing.sumInkMva += f.sumInkMva;
      existing.antall++;
      if (f.status === "forfalt") existing.forfalte++;
      perMåned.set(mnd, existing);
    }
    return [...perMåned.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([periode, data]) => {
        const [år, mnd] = periode.split("-").map(Number);
        return {
          periode,
          label: `${MÅNEDSNAVN[mnd - 1]} ${år}`,
          ...data,
        };
      });
  }, [fakturaer]);

  return (
    <div className="space-y-6">
      {/* ── Topptekst ── */}
      <SlideIn>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Banknote className="h-6 w-6 text-primary" />
            Cashflow-prognose
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {aktivKlient ? aktivKlient.navn : "Alle klienter"} · Likviditetsanalyse og fremskrivning
          </p>
        </div>
      </SlideIn>

      {/* ── KPI-kort ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))
        ) : (
          <>
            <Card>
              <CardHeader className="pb-1">
                <CardDescription className="flex items-center gap-1 text-[11px]">
                  <ArrowUpRight className="h-3 w-3 text-green-500" /> Total innbetalinger
                </CardDescription>
                <CardTitle className="text-lg font-mono text-green-600">
                  {formatNOK(cashflow.totalInn)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardDescription className="flex items-center gap-1 text-[11px]">
                  <ArrowDownRight className="h-3 w-3 text-red-500" /> Total utbetalinger
                </CardDescription>
                <CardTitle className="text-lg font-mono text-red-600">
                  {formatNOK(cashflow.totalUt)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardDescription className="flex items-center gap-1 text-[11px]">
                  <ArrowRightLeft className="h-3 w-3" /> Snitt netto/mnd
                </CardDescription>
                <CardTitle className={`text-lg font-mono ${cashflow.snittNetto >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {formatNOK(cashflow.snittNetto)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardDescription className="flex items-center gap-1 text-[11px]">
                  <Banknote className="h-3 w-3" /> Akkumulert (nå)
                </CardDescription>
                <CardTitle className={`text-lg font-mono ${(sistHistorisk?.akkumulert ?? 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {formatNOK(sistHistorisk?.akkumulert ?? 0)}
                </CardTitle>
              </CardHeader>
            </Card>
          </>
        )}
      </div>

      {/* ── Cashflow-graf ── */}
      <SlideIn>
        {loading ? (
          <Skeleton className="h-48 rounded-lg" />
        ) : cashflow.måneder.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Banknote className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Ingen cashflow-data</p>
              <p className="text-sm mt-1">Bokfør bilag for å se cashflow-oversikten.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Månedlig cashflow</CardTitle>
              <CardDescription className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm bg-green-500/70" /> Inn
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-500/70" /> Ut
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm bg-green-400/40 border border-dashed border-green-500/40" /> Prognose
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-1 overflow-x-auto pb-2">
                {cashflow.måneder.map((m) => (
                  <CashflowBar key={m.periode} måned={m} maxAbsVerdi={maxAbsVerdi} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </SlideIn>

      {/* ── Akkumulert prognose-varsel ── */}
      {sistePrognose && sistePrognose.erPrognose && (
        <SlideIn>
          <Card className={sistePrognose.akkumulert < 0 ? "border-red-300 bg-red-50/50 dark:bg-red-950/20" : "border-green-300 bg-green-50/50 dark:bg-green-950/20"}>
            <CardContent className="py-4 flex items-start gap-3">
              {sistePrognose.akkumulert < 0 ? (
                <TrendingDown className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              ) : (
                <TrendingUp className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <p className={`text-sm font-medium ${sistePrognose.akkumulert < 0 ? "text-red-700 dark:text-red-400" : "text-green-700 dark:text-green-400"}`}>
                  {sistePrognose.akkumulert < 0
                    ? "Likviditetsutfordring forventet"
                    : "Positiv likviditetstrend"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Basert på glidende gjennomsnitt av siste 3 måneder, er forventet akkumulert
                  cashflow om 6 måneder:{" "}
                  <span className={`font-mono font-medium ${sistePrognose.akkumulert < 0 ? "text-red-600" : "text-green-600"}`}>
                    {formatNOK(sistePrognose.akkumulert)}
                  </span>.
                </p>
              </div>
            </CardContent>
          </Card>
        </SlideIn>
      )}

      {/* ── Detaljert månedstabell ── */}
      {cashflow.måneder.length > 0 && (
        <SlideIn>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Månedlig detalj</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[480px]">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Periode</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-green-600">Inn</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-red-600">Ut</th>
                      <th className="px-4 py-2 text-right text-xs font-medium">Netto</th>
                      <th className="px-4 py-2 text-right text-xs font-medium">Akkumulert</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashflow.måneder.map((m) => (
                      <tr
                        key={m.periode}
                        className={`border-b last:border-0 ${
                          m.erPrognose ? "bg-muted/20 text-muted-foreground" : ""
                        }`}
                      >
                        <td className="px-4 py-2 flex items-center gap-2">
                          <span className="capitalize">{m.label}</span>
                          {m.erPrognose && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1 italic">
                              prognose
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-xs text-green-600">
                          {formatKortNOK(m.innbetalinger)}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-xs text-red-600">
                          {formatKortNOK(m.utbetalinger)}
                        </td>
                        <td className={`px-4 py-2 text-right font-mono text-xs ${m.netto >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {m.netto >= 0 ? "+" : ""}{formatKortNOK(m.netto)}
                        </td>
                        <td className={`px-4 py-2 text-right font-mono text-xs font-medium ${m.akkumulert >= 0 ? "text-foreground" : "text-red-600"}`}>
                          {formatNOK(m.akkumulert)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </SlideIn>
      )}

      {/* ── Forventede innbetalinger fra fakturaer ── */}
      {forventedeFakturaer.length > 0 && (
        <SlideIn>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FilePlus className="h-4 w-4 text-blue-500" />
                  Forventede innbetalinger — fakturaer
                </CardTitle>
                <Link
                  href="/dashboard/faktura"
                  className="text-xs text-primary hover:underline underline-offset-4"
                >
                  Se alle →
                </Link>
              </div>
              <CardDescription className="text-xs">
                Utestående fakturaer (sendt + forfalt) gruppert per forfallsmåned
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 pb-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[380px]">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Forfallsmåned</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Antall</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-green-600">Forventet inn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forventedeFakturaer.map((rad) => (
                      <tr key={rad.periode} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-2 flex items-center gap-2 capitalize">
                          {rad.label}
                          {rad.forfalte > 0 && (
                            <span className="flex items-center gap-0.5 text-xs text-red-500">
                              <AlertCircle className="h-3 w-3" />
                              {rad.forfalte} forfalt
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right text-xs text-muted-foreground">
                          {rad.antall}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-xs font-medium text-green-600">
                          {formatNOK(rad.sumInkMva)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t bg-muted/30">
                      <td className="px-4 py-2 text-xs font-semibold">Totalt utestående</td>
                      <td className="px-4 py-2 text-right text-xs">
                        {forventedeFakturaer.reduce((s, r) => s + r.antall, 0)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-sm font-bold text-green-600">
                        {formatNOK(forventedeFakturaer.reduce((s, r) => s + r.sumInkMva, 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </SlideIn>
      )}
    </div>
  );
}
