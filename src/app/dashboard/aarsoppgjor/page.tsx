"use client";

/**
 * Årsoppgjør — komplett årsregnskap per regnskapsår.
 * Genererer resultatregnskap + balanse, og støtter:
 * - Print til PDF (browser print-dialog → "Lagre som PDF")
 * - SAF-T XML-eksport for hele regnskapsåret
 * - CSV-eksport av resultatregnskap
 *
 * Iht. Bokføringsloven og Regnskapsloven.
 */

import { useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Printer,
  Download,
  TrendingUp,
  TrendingDown,
  BarChart3,
  FileBarChart,
  Building2,
} from "lucide-react";
import { SlideIn } from "@/components/motion";
import { useAuth } from "@/hooks/use-auth";
import { useRapporter } from "@/hooks/use-rapporter";
import { useAktivKlient } from "@/hooks/use-aktiv-klient";
import { useMotparter } from "@/hooks/use-motparter";
import { lastNedSaftXml } from "@/lib/saft-eksport";
import { eksporterResultatCsv } from "@/lib/eksport";

function formatNOK(value: number) {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function nåværendeOgTidligereÅr(): number[] {
  const nå = new Date().getFullYear();
  return [nå, nå - 1, nå - 2, nå - 3].filter((å) => å >= 2020);
}

export default function AarsoppgjorPage() {
  const { user } = useAuth();
  const { aktivKlient, aktivKlientId } = useAktivKlient();
  const { loading, bilag, resultatForPeriode, balanse } = useRapporter(
    user?.uid ?? null,
    aktivKlientId ?? undefined
  );
  const { motparter } = useMotparter(user?.uid ?? null, aktivKlientId);

  const tilgjengeligeÅr = useMemo(() => {
    const fraBilag = new Set(bilag.map((b) => b.dato.slice(0, 4)));
    const standard = nåværendeOgTidligereÅr().map(String);
    return [...new Set([...standard, ...fraBilag])].sort().reverse();
  }, [bilag]);

  const [valgtÅr, setValgtÅr] = useState(() => String(new Date().getFullYear()));

  const resultat = resultatForPeriode(valgtÅr);
  const ingenData = resultat.driftsinntekter.length === 0 && resultat.driftskostnader.length === 0;

  const bilagForÅr = bilag.filter((b) => b.dato.startsWith(valgtÅr));

  function handlePrint() {
    window.print();
  }

  function handleSaftEksport() {
    if (!aktivKlient) return;
    lastNedSaftXml({
      bilag: bilagForÅr,
      klient: aktivKlient,
      motparter,
      periodeStart: `${valgtÅr}-01-01`,
      periodeSlutt: `${valgtÅr}-12-31`,
    });
  }

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Toppseksjon (skjult ved print) */}
      <SlideIn direction="up" duration={0.4} className="print:hidden">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Årsoppgjør</h1>
            <p className="text-muted-foreground">
              Resultatregnskap og balanse per regnskapsår.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => eksporterResultatCsv(resultat, valgtÅr)}>
              <Download className="mr-2 h-4 w-4" />
              CSV
            </Button>
            {aktivKlient && (
              <Button variant="outline" onClick={handleSaftEksport}>
                <FileBarChart className="mr-2 h-4 w-4" />
                SAF-T
              </Button>
            )}
            <Button onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Skriv ut / PDF
            </Button>
          </div>
        </div>
      </SlideIn>

      {/* Årsvelger */}
      <SlideIn direction="up" delay={0.05} className="print:hidden">
        <div className="flex flex-wrap gap-2">
          {tilgjengeligeÅr.map((år) => (
            <Button
              key={år}
              variant={valgtÅr === år ? "default" : "outline"}
              size="sm"
              onClick={() => setValgtÅr(år)}
            >
              {år}
            </Button>
          ))}
        </div>
      </SlideIn>

      {/* Mangler klient */}
      {!aktivKlient && !loading && (
        <SlideIn direction="up">
          <div className="rounded-xl border border-border/40 py-12 text-center text-muted-foreground">
            <Building2 className="mx-auto mb-3 h-8 w-8 opacity-40" />
            <p className="text-sm font-medium">Velg en klient i sidemenyen</p>
            <p className="text-xs mt-1">Årsoppgjøret er knyttet til en spesifikk regnskapsklient.</p>
          </div>
        </SlideIn>
      )}

      {/* Print-header (kun synlig ved print) */}
      {aktivKlient && (
        <div className="hidden print:block mb-8">
          <h1 className="text-3xl font-bold">{aktivKlient.navn}</h1>
          <p className="text-lg text-gray-600">Org.nr: {aktivKlient.orgnr}</p>
          <p className="text-lg font-semibold mt-2">Årsregnskap {valgtÅr}</p>
          <p className="text-sm text-gray-500 mt-1">
            Utarbeidet {new Date().toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-3 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Ingen data */}
      {!loading && ingenData && (
        <SlideIn direction="up">
          <div className="rounded-xl border border-border/40 py-16 text-center text-muted-foreground">
            <BarChart3 className="mx-auto mb-3 h-8 w-8 opacity-40" />
            <p className="text-sm font-medium">Ingen bokførte bilag for {valgtÅr}</p>
            <p className="text-xs mt-1">Bokfør bilag for å generere årsoppgjør.</p>
          </div>
        </SlideIn>
      )}

      {!loading && !ingenData && (
        <>
          {/* KPI-sammendrag */}
          <div className="grid gap-4 sm:grid-cols-3 print:grid-cols-3">
            {[
              {
                label: "Driftsinntekter",
                value: resultat.totalInntekter,
                icon: TrendingUp,
                farge: "text-green-600",
              },
              {
                label: "Driftskostnader",
                value: resultat.totalKostnader,
                icon: TrendingDown,
                farge: "text-red-500",
              },
              {
                label: "Årsresultat",
                value: resultat.resultat,
                icon: BarChart3,
                farge: resultat.resultat >= 0 ? "text-green-600" : "text-red-500",
              },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardDescription className="text-xs font-medium uppercase tracking-wide">
                    {stat.label}
                  </CardDescription>
                  <stat.icon className={`h-4 w-4 ${stat.farge}`} />
                </CardHeader>
                <CardContent>
                  <p className={`text-2xl font-bold ${stat.farge}`}>
                    {formatNOK(stat.value)}
                  </p>
                  <Badge
                    variant={stat.value >= 0 ? "default" : "destructive"}
                    className="mt-1 text-xs"
                  >
                    {valgtÅr}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Resultatregnskap */}
          <Card className="print:border print:shadow-none">
            <CardHeader>
              <CardTitle className="text-base">
                Resultatregnskap {valgtÅr}
              </CardTitle>
              {aktivKlient && (
                <CardDescription>{aktivKlient.navn} · Org.nr {aktivKlient.orgnr}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="py-2 text-left font-medium">Konto</th>
                    <th className="py-2 text-left font-medium">Beskrivelse</th>
                    <th className="py-2 text-right font-medium">Beløp</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={3} className="pt-4 pb-2 font-semibold text-green-700 uppercase text-xs tracking-wide">
                      Driftsinntekter
                    </td>
                  </tr>
                  {resultat.driftsinntekter.map((r) => (
                    <tr key={r.konto} className="border-b border-border/20">
                      <td className="py-1.5 font-mono text-xs text-muted-foreground">{r.konto}</td>
                      <td className="py-1.5 pl-2">{r.navn}</td>
                      <td className="py-1.5 text-right font-mono">{formatNOK(r.belop)}</td>
                    </tr>
                  ))}
                  <tr className="border-b-2 border-border font-semibold">
                    <td className="py-2" colSpan={2}>Sum driftsinntekter</td>
                    <td className="py-2 text-right font-mono text-green-700">{formatNOK(resultat.totalInntekter)}</td>
                  </tr>

                  <tr>
                    <td colSpan={3} className="pt-4 pb-2 font-semibold text-red-700 uppercase text-xs tracking-wide">
                      Driftskostnader
                    </td>
                  </tr>
                  {resultat.driftskostnader.map((r) => (
                    <tr key={r.konto} className="border-b border-border/20">
                      <td className="py-1.5 font-mono text-xs text-muted-foreground">{r.konto}</td>
                      <td className="py-1.5 pl-2">{r.navn}</td>
                      <td className="py-1.5 text-right font-mono">{formatNOK(r.belop)}</td>
                    </tr>
                  ))}
                  <tr className="border-b-2 border-border font-semibold">
                    <td className="py-2" colSpan={2}>Sum driftskostnader</td>
                    <td className="py-2 text-right font-mono text-red-600">{formatNOK(resultat.totalKostnader)}</td>
                  </tr>

                  <tr className="bg-muted/30">
                    <td className="py-3 font-bold text-base" colSpan={2}>Årsresultat</td>
                    <td className={`py-3 text-right font-mono font-bold text-base ${resultat.resultat >= 0 ? "text-green-700" : "text-red-600"}`}>
                      {formatNOK(resultat.resultat)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Balanse */}
          {(balanse.eiendeler.length > 0 || balanse.gjeldOgEgenkapital.length > 0) && (
            <Card className="print:border print:shadow-none">
              <CardHeader>
                <CardTitle className="text-base">Balanse {valgtÅr}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 sm:grid-cols-2 print:grid-cols-2">
                  {/* Eiendeler */}
                  <div>
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3">Eiendeler</h3>
                    <table className="w-full text-sm">
                      <tbody>
                        {balanse.eiendeler.map((e) => (
                          <tr key={e.konto} className="border-b border-border/20">
                            <td className="py-1.5 font-mono text-xs text-muted-foreground">{e.konto}</td>
                            <td className="py-1.5 pl-2">{e.navn}</td>
                            <td className="py-1.5 text-right font-mono">{formatNOK(e.belop)}</td>
                          </tr>
                        ))}
                        <tr className="font-semibold border-t-2 border-border">
                          <td colSpan={2} className="py-2">Sum eiendeler</td>
                          <td className="py-2 text-right font-mono">{formatNOK(balanse.totalEiendeler)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Gjeld og egenkapital */}
                  <div>
                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3">Gjeld og egenkapital</h3>
                    <table className="w-full text-sm">
                      <tbody>
                        {balanse.gjeldOgEgenkapital.map((g) => (
                          <tr key={g.konto} className="border-b border-border/20">
                            <td className="py-1.5 font-mono text-xs text-muted-foreground">{g.konto}</td>
                            <td className="py-1.5 pl-2">{g.navn}</td>
                            <td className="py-1.5 text-right font-mono">{formatNOK(g.belop)}</td>
                          </tr>
                        ))}
                        <tr className="font-semibold border-t-2 border-border">
                          <td colSpan={2} className="py-2">Sum gjeld</td>
                          <td className="py-2 text-right font-mono">{formatNOK(balanse.totalGjeld)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Bilagoversikt */}
          <Card className="print:border print:shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Bilagoversikt {valgtÅr}</CardTitle>
              <CardDescription>
                {bilagForÅr.length} bilag · {bilagForÅr.filter(b => b.status === "bokført" || b.status === "kreditert").length} bokførte
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {(["bokført", "kreditert", "ubehandlet", "avvist"] as const).map((status) => {
                  const antall = bilagForÅr.filter(b => b.status === status).length;
                  if (antall === 0) return null;
                  return (
                    <div key={status} className="rounded-lg border border-border/50 px-4 py-2 text-center">
                      <p className="text-xl font-bold">{antall}</p>
                      <p className="text-xs text-muted-foreground capitalize">{status}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
