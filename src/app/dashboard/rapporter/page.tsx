"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileBarChart,
  Download,
  TrendingUp,
  TrendingDown,
  BarChart3,
  FileText,
  AlertCircle,
} from "lucide-react";
import { SlideIn, StaggerList, StaggerItem } from "@/components/motion";
import { useAuth } from "@/hooks/use-auth";
import { useRapporter } from "@/hooks/use-rapporter";

type Fane = "resultat" | "balanse" | "mva" | "saft";

function formatNOK(value: number) {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

const periodeAlternativer = [
  { key: "2026-01", label: "Januar 2026" },
  { key: "2026-02", label: "Februar 2026" },
  { key: "2026-03", label: "Mars 2026" },
  { key: "2026", label: "Hele 2026" },
  { key: "alt", label: "Alle perioder" },
];

export default function RapporterPage() {
  const { user } = useAuth();
  const { loading, resultatForPeriode, balanse, mvaTerminer } = useRapporter(
    user?.uid ?? null
  );
  const [valgtPeriode, setValgtPeriode] = useState("2026-03");
  const [aktivFane, setAktivFane] = useState<Fane>("resultat");

  const resultat = resultatForPeriode(valgtPeriode);
  const ingenData = resultat.driftsinntekter.length === 0 && resultat.driftskostnader.length === 0;

  return (
    <div className="space-y-6">
      {/* Toppseksjon */}
      <SlideIn direction="up" duration={0.4}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Rapporter</h1>
            <p className="text-muted-foreground">
              Resultatregnskap, balanse, MVA-rapport og SAF-T-eksport.
            </p>
          </div>
          <Button variant="outline" disabled>
            <Download className="mr-2 h-4 w-4" />
            Eksporter
          </Button>
        </div>
      </SlideIn>

      {/* Periodevalgknapper */}
      <SlideIn direction="up" delay={0.1}>
        <div className="flex flex-wrap gap-2">
          {periodeAlternativer.map((p) => (
            <Button
              key={p.key}
              variant={valgtPeriode === p.key ? "default" : "outline"}
              size="sm"
              onClick={() => setValgtPeriode(p.key)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </SlideIn>

      {/* Fanenavigasjon */}
      <SlideIn direction="up" delay={0.15}>
        <div className="flex gap-1 rounded-lg border border-border/50 p-1 w-fit">
          {[
            { id: "resultat" as Fane, label: "Resultatregnskap", icon: TrendingUp },
            { id: "balanse" as Fane, label: "Balanse", icon: BarChart3 },
            { id: "mva" as Fane, label: "MVA-rapport", icon: FileText },
            { id: "saft" as Fane, label: "SAF-T", icon: FileBarChart },
          ].map((fane) => (
            <Button
              key={fane.id}
              variant={aktivFane === fane.id ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setAktivFane(fane.id)}
              className="gap-1.5"
            >
              <fane.icon className="h-3.5 w-3.5" />
              {fane.label}
            </Button>
          ))}
        </div>
      </SlideIn>

      {/* Laste-tilstand */}
      {loading && (
        <div className="space-y-4">
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
          <Card>
            <CardContent className="p-6 space-y-2">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Resultatregnskap */}
      {!loading && aktivFane === "resultat" && (
        <div className="space-y-4">
          {ingenData ? (
            <SlideIn direction="up">
              <div className="rounded-xl border border-border/40 py-16 text-center text-muted-foreground">
                <BarChart3 className="mx-auto mb-3 h-8 w-8 opacity-40" />
                <p className="text-sm font-medium">Ingen data for valgt periode</p>
                <p className="text-xs mt-1">Bokfør bilag for å se resultatregnskap.</p>
              </div>
            </SlideIn>
          ) : (
            <>
              {/* Sammendrag */}
              <StaggerList className="grid gap-4 sm:grid-cols-3" staggerDelay={0.07}>
                {[
                  { label: "Driftsinntekter", value: resultat.totalInntekter, icon: TrendingUp, color: "text-green-500" },
                  { label: "Driftskostnader", value: resultat.totalKostnader, icon: TrendingDown, color: "text-red-500" },
                  { label: "Driftsresultat", value: resultat.resultat, icon: BarChart3, color: resultat.resultat > 0 ? "text-green-600" : "text-red-500" },
                ].map((stat) => (
                  <StaggerItem key={stat.label}>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardDescription className="text-xs font-medium uppercase tracking-wide">
                          {stat.label}
                        </CardDescription>
                        <stat.icon className={`h-4 w-4 ${stat.color}`} />
                      </CardHeader>
                      <CardContent>
                        <p className={`text-2xl font-bold ${stat.color}`}>
                          {formatNOK(stat.value)}
                        </p>
                      </CardContent>
                    </Card>
                  </StaggerItem>
                ))}
              </StaggerList>

              {/* Detaljert tabell */}
              <SlideIn direction="up" delay={0.2}>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Resultatregnskap — {periodeAlternativer.find(p => p.key === valgtPeriode)?.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">Konto</th>
                          <th className="px-4 py-3 text-left font-medium text-muted-foreground">Navn</th>
                          <th className="px-4 py-3 text-right font-medium text-muted-foreground">Beløp</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td colSpan={3} className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground bg-muted/30">
                            Driftsinntekter
                          </td>
                        </tr>
                        {resultat.driftsinntekter.map((r) => (
                          <tr key={r.konto} className="border-t border-border/30">
                            <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{r.konto}</td>
                            <td className="px-4 py-2">{r.navn}</td>
                            <td className="px-4 py-2 text-right font-medium text-green-600">{formatNOK(r.belop)}</td>
                          </tr>
                        ))}
                        <tr className="border-t border-border bg-muted/20">
                          <td className="px-4 py-2 font-mono text-xs"></td>
                          <td className="px-4 py-2 font-semibold">Sum driftsinntekter</td>
                          <td className="px-4 py-2 text-right font-bold text-green-600">{formatNOK(resultat.totalInntekter)}</td>
                        </tr>
                        <tr>
                          <td colSpan={3} className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground bg-muted/30">
                            Driftskostnader
                          </td>
                        </tr>
                        {resultat.driftskostnader.map((r) => (
                          <tr key={r.konto} className="border-t border-border/30">
                            <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{r.konto}</td>
                            <td className="px-4 py-2">{r.navn}</td>
                            <td className="px-4 py-2 text-right font-medium text-red-500">{formatNOK(r.belop)}</td>
                          </tr>
                        ))}
                        <tr className="border-t border-border bg-muted/20">
                          <td className="px-4 py-2 font-mono text-xs"></td>
                          <td className="px-4 py-2 font-semibold">Sum driftskostnader</td>
                          <td className="px-4 py-2 text-right font-bold text-red-500">{formatNOK(resultat.totalKostnader)}</td>
                        </tr>
                        <tr className="border-t-2 border-border">
                          <td className="px-4 py-3 font-mono text-xs"></td>
                          <td className="px-4 py-3 font-bold text-base">Driftsresultat</td>
                          <td className={`px-4 py-3 text-right font-bold text-base ${resultat.resultat > 0 ? "text-green-600" : "text-red-500"}`}>
                            {formatNOK(resultat.resultat)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </SlideIn>
            </>
          )}
        </div>
      )}

      {/* Balanse */}
      {!loading && aktivFane === "balanse" && (
        <SlideIn direction="up">
          {balanse.eiendeler.length === 0 ? (
            <div className="rounded-xl border border-border/40 py-16 text-center text-muted-foreground">
              <BarChart3 className="mx-auto mb-3 h-8 w-8 opacity-40" />
              <p className="text-sm font-medium">Ingen balansedata</p>
              <p className="text-xs mt-1">Bokfør bilag med kontoer i klasse 1 og 2 for å se balansen.</p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Eiendeler</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-muted-foreground">Konto</th>
                        <th className="px-4 py-2 text-left font-medium text-muted-foreground">Navn</th>
                        <th className="px-4 py-2 text-right font-medium text-muted-foreground">Beløp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {balanse.eiendeler.map((r) => (
                        <tr key={r.konto} className="border-t border-border/30">
                          <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{r.konto}</td>
                          <td className="px-4 py-2">{r.navn}</td>
                          <td className="px-4 py-2 text-right font-medium">{formatNOK(r.belop)}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-border bg-muted/20">
                        <td className="px-4 py-3"></td>
                        <td className="px-4 py-3 font-bold">Sum eiendeler</td>
                        <td className="px-4 py-3 text-right font-bold">{formatNOK(balanse.totalEiendeler)}</td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Gjeld og egenkapital</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-muted-foreground">Konto</th>
                        <th className="px-4 py-2 text-left font-medium text-muted-foreground">Navn</th>
                        <th className="px-4 py-2 text-right font-medium text-muted-foreground">Beløp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {balanse.gjeldOgEgenkapital.map((r) => (
                        <tr key={r.konto} className="border-t border-border/30">
                          <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{r.konto}</td>
                          <td className="px-4 py-2">{r.navn}</td>
                          <td className="px-4 py-2 text-right font-medium">{formatNOK(r.belop)}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-border bg-muted/20">
                        <td className="px-4 py-3"></td>
                        <td className="px-4 py-3 font-bold">Sum gjeld og EK</td>
                        <td className="px-4 py-3 text-right font-bold">{formatNOK(balanse.totalGjeld)}</td>
                      </tr>
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          )}
        </SlideIn>
      )}

      {/* MVA-rapport */}
      {!loading && aktivFane === "mva" && (
        <div className="space-y-4">
          {mvaTerminer.length === 0 ? (
            <SlideIn direction="up">
              <div className="rounded-xl border border-border/40 py-16 text-center text-muted-foreground">
                <FileText className="mx-auto mb-3 h-8 w-8 opacity-40" />
                <p className="text-sm font-medium">Ingen MVA-data</p>
                <p className="text-xs mt-1">Bokfør bilag med MVA-kontoer (271x/274x) for å se MVA-rapporten.</p>
              </div>
            </SlideIn>
          ) : (
            <StaggerList className="space-y-4" staggerDelay={0.08}>
              {mvaTerminer.map((termin) => (
                <StaggerItem key={termin.periode}>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-3">
                      <CardTitle className="text-base">{termin.periode}</CardTitle>
                      <Badge variant={termin.åBetale <= 0 ? "default" : "outline"}>
                        {termin.åBetale <= 0 ? "Til gode" : "Utkast"}
                      </Badge>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-lg bg-muted/50 p-3">
                          <p className="text-xs text-muted-foreground">Utgående MVA</p>
                          <p className="mt-1 text-lg font-bold">{formatNOK(termin.utgåendeMva)}</p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-3">
                          <p className="text-xs text-muted-foreground">Inngående MVA (fradrag)</p>
                          <p className="mt-1 text-lg font-bold text-green-600">− {formatNOK(termin.inngåendeMva)}</p>
                        </div>
                        <div className="rounded-lg bg-primary/10 p-3 border border-primary/20">
                          <p className="text-xs text-muted-foreground">Å betale til Skatteetaten</p>
                          <p className="mt-1 text-lg font-bold text-primary">{formatNOK(termin.åBetale)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </StaggerItem>
              ))}
            </StaggerList>
          )}
        </div>
      )}

      {/* SAF-T */}
      {!loading && aktivFane === "saft" && (
        <SlideIn direction="up">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileBarChart className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">SAF-T-eksport</CardTitle>
              </div>
              <CardDescription>
                Standard Audit File for Tax — norsk format for myndighetskrav og revisjon.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Funksjon under utvikling</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    SAF-T-eksport vil være tilgjengelig i neste versjon. Filen vil inneholde
                    alle transaksjoner i henhold til Skatteetatens krav til SAF-T Financial.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-medium">Hva inkluderes i SAF-T-filen</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {[
                    "Kontoplan (NS 4102)",
                    "Kunder og leverandører",
                    "Alle bilag og posteringer",
                    "MVA-transaksjoner og koder",
                    "Åpningsbalanse og periodesaldi",
                  ].map((punkt) => (
                    <li key={punkt} className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                      {punkt}
                    </li>
                  ))}
                </ul>
              </div>

              <Button disabled>
                <Download className="mr-2 h-4 w-4" />
                Generer SAF-T XML (kommer snart)
              </Button>
            </CardContent>
          </Card>
        </SlideIn>
      )}
    </div>
  );
}
