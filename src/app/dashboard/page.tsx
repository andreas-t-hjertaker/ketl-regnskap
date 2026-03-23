"use client";

import { useAuth } from "@/hooks/use-auth";
import { useBilag } from "@/hooks/use-bilag";
import { useAktivKlient } from "@/hooks/use-aktiv-klient";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  TrendingDown,
  Receipt,
  AlertCircle,
  Bot,
  CheckCircle2,
  Clock,
  BarChart3,
  RotateCcw,
  Archive,
} from "lucide-react";
import {
  SlideIn,
  StaggerList,
  StaggerItem,
  AnimatedCounter,
} from "@/components/motion";
import { Varsler } from "@/components/varsler";
import { Fristmonitor } from "@/components/fristmonitor";
import { InntektKostnadGraf } from "@/components/inntekt-kostnad-graf";
import { AnomaliWidget } from "@/components/anomali-widget";
import { useAnomalideteksjon } from "@/hooks/use-anomalideteksjon";

function formatNOK(value: number) {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function tidSiden(dato: unknown): string {
  if (!dato) return "ukjent";
  const d = dato instanceof Date ? dato : new Date((dato as { seconds: number }).seconds * 1000);
  const diff = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diff < 60) return `${diff} min siden`;
  const timer = Math.floor(diff / 60);
  if (timer < 24) return `${timer}t siden`;
  return `${Math.floor(timer / 24)}d siden`;
}

function beregnInntektOgKostnad(bilag: ReturnType<typeof useBilag>["bilag"]) {
  let inntekter = 0;
  let kostnader = 0;

  for (const b of bilag) {
    if (b.status !== "bokført" && b.status !== "kreditert") continue;
    for (const p of b.posteringer) {
      const klasse = p.kontonr[0];
      if (klasse === "3") inntekter += p.kredit - p.debet;
      if (klasse >= "4" && klasse <= "8") kostnader += p.debet - p.kredit;
    }
  }

  return { inntekter: Math.abs(inntekter), kostnader: Math.abs(kostnader) };
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { aktivKlientId, aktivKlient, visAlleKlienter } = useAktivKlient();
  const { bilag, loading } = useBilag(user?.uid ?? null, aktivKlientId);

  const inntektKostnad = beregnInntektOgKostnad(bilag);
  const ubehandledeBilag = bilag.filter((b) => b.status === "ubehandlet").slice(0, 5);
  const antallUbehandlet = bilag.filter((b) => b.status === "ubehandlet").length;
  const anomalier = useAnomalideteksjon(bilag);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Velkomsthilsen */}
      <SlideIn direction="up" duration={0.4}>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            {(() => {
              const timer = new Date().getHours();
              if (timer < 12) return "God morgen";
              if (timer < 17) return "God ettermiddag";
              return "God kveld";
            })()}{user?.displayName ? `, ${user.displayName}` : ""}
          </h1>
          <p className="text-muted-foreground">
            {visAlleKlienter
              ? "Her er regnskapsoversikten din."
              : <>Oversikt for <span className="font-medium text-foreground">{aktivKlient?.navn}</span>.</>
            }
          </p>
        </div>
      </SlideIn>

      {/* Varsler */}
      {!loading && <Varsler bilag={bilag} />}

      {/* Anomalideteksjon (#38) */}
      {!loading && anomalier.length > 0 && (
        <AnomaliWidget
          anomalier={anomalier}
          onBilagKlikk={(id) => {
            window.location.href = `/dashboard/bilag?bilag=${id}`;
          }}
        />
      )}

      {/* Fristmonitor */}
      <SlideIn direction="up" delay={0.05}>
        <Fristmonitor />
      </SlideIn>

      {/* KPI-kort */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-3 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-28" />
                <Skeleton className="h-3 w-36 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <StaggerList className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" staggerDelay={0.08}>
          {[
            {
              label: "Omsetning (bokført)",
              value: inntektKostnad.inntekter,
              format: "nok" as const,
              icon: TrendingUp,
              trend: `Fra ${bilag.filter(b => b.status === "bokført").length} bokførte bilag`,
              trendUp: true,
            },
            {
              label: "Kostnader (bokført)",
              value: inntektKostnad.kostnader,
              format: "nok" as const,
              icon: TrendingDown,
              trend: "Driftskostnader",
              trendUp: false,
            },
            {
              label: "Resultat",
              value: inntektKostnad.inntekter - inntektKostnad.kostnader,
              format: "nok" as const,
              icon: BarChart3,
              trend: inntektKostnad.inntekter - inntektKostnad.kostnader >= 0 ? "Positivt resultat" : "Negativt resultat",
              trendUp: inntektKostnad.inntekter - inntektKostnad.kostnader >= 0,
            },
            {
              label: "Ubehandlede bilag",
              value: antallUbehandlet,
              format: "count" as const,
              icon: AlertCircle,
              trend: antallUbehandlet > 0 ? "Trenger gjennomgang" : "Alle bilag behandlet",
              trendUp: antallUbehandlet === 0,
            },
          ].map((kpi) => (
            <StaggerItem key={kpi.label}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardDescription className="text-xs font-medium uppercase tracking-wide">
                    {kpi.label}
                  </CardDescription>
                  <kpi.icon
                    className={`h-4 w-4 ${kpi.trendUp ? "text-green-500" : kpi.label === "Ubehandlede bilag" ? "text-orange-500" : "text-red-500"}`}
                  />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {kpi.format === "nok" ? (
                      formatNOK(kpi.value)
                    ) : (
                      <AnimatedCounter value={kpi.value} />
                    )}
                  </p>
                  <p className={`mt-1 text-xs ${kpi.trendUp ? "text-green-600" : "text-muted-foreground"}`}>
                    {kpi.trend}
                  </p>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </StaggerList>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Siste bilag */}
        <div>
          <SlideIn direction="up" delay={0.1}>
            <div className="mb-4 flex items-center gap-3">
              <h2 className="text-lg font-semibold">Siste bilag</h2>
              <Badge variant="outline" className="font-mono text-xs">
                <Receipt className="mr-1.5 h-3 w-3" />
                {bilag.length} totalt
              </Badge>
            </div>
          </SlideIn>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border border-border/50 px-4 py-3">
                  <Skeleton className="h-4 w-4 shrink-0" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-3 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-3 w-16 shrink-0" />
                </div>
              ))}
            </div>
          ) : bilag.length === 0 ? (
            <div className="rounded-lg border border-border/40 py-8 text-center text-muted-foreground">
              <Receipt className="mx-auto mb-2 h-6 w-6 opacity-40" />
              <p className="text-sm">Ingen bilag ennå. Last opp en kvittering for å komme i gang.</p>
            </div>
          ) : (
            <StaggerList className="space-y-3" staggerDelay={0.06} initialDelay={0.15}>
              {bilag.slice(0, 5).map((b) => {
                const statusFarger: Record<typeof b.status, string> = {
                  bokført: "text-green-500",
                  foreslått: "text-blue-500",
                  ubehandlet: "text-orange-500",
                  avvist: "text-destructive",
                  kreditert: "text-muted-foreground",
                  arkivert: "text-muted-foreground",
                };
                const StatusIkon = {
                  bokført: CheckCircle2,
                  foreslått: Bot,
                  ubehandlet: Clock,
                  avvist: AlertCircle,
                  kreditert: RotateCcw,
                  arkivert: Archive,
                }[b.status];
                return (
                  <StaggerItem key={b.id}>
                    <div className="flex items-start gap-3 rounded-lg border border-border/50 bg-card/50 px-4 py-3">
                      <StatusIkon className={`mt-0.5 h-4 w-4 shrink-0 ${statusFarger[b.status]}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{b.beskrivelse}</p>
                        <p className="text-xs text-muted-foreground">{b.leverandor ?? "—"} · {b.dato}</p>
                      </div>
                      <div className="text-sm font-medium shrink-0">{formatNOK(b.belop)}</div>
                    </div>
                  </StaggerItem>
                );
              })}
            </StaggerList>
          )}
        </div>

        {/* Bilag som trenger oppmerksomhet */}
        <div>
          <SlideIn direction="up" delay={0.1}>
            <div className="mb-4 flex items-center gap-3">
              <h2 className="text-lg font-semibold">Trenger oppmerksomhet</h2>
              <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/30 font-mono text-xs">
                {antallUbehandlet} ubehandlet
              </Badge>
            </div>
          </SlideIn>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border border-border/50 px-4 py-3">
                  <Skeleton className="h-4 w-4 shrink-0" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-3 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-3 w-16 shrink-0" />
                </div>
              ))}
            </div>
          ) : ubehandledeBilag.length === 0 ? (
            <div className="rounded-lg border border-green-500/20 bg-green-500/5 py-8 text-center text-muted-foreground">
              <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-green-500 opacity-80" />
              <p className="text-sm font-medium text-green-700 dark:text-green-400">Alt er behandlet!</p>
              <p className="text-xs mt-1">Ingen bilag venter på bokføring.</p>
            </div>
          ) : (
            <>
              <StaggerList className="space-y-3" staggerDelay={0.06} initialDelay={0.15}>
                {ubehandledeBilag.map((b) => (
                  <StaggerItem key={b.id}>
                    <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/50 px-4 py-3">
                      <Receipt className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{b.beskrivelse}</p>
                        <p className="text-xs text-muted-foreground">
                          {b.leverandor ?? "—"} · {b.dato}
                        </p>
                      </div>
                      <div className="text-sm font-medium shrink-0">
                        {formatNOK(b.belop)}
                      </div>
                    </div>
                  </StaggerItem>
                ))}
              </StaggerList>
              {antallUbehandlet > 5 && (
                <SlideIn direction="up" delay={0.3}>
                  <p className="mt-3 text-xs text-muted-foreground">
                    + {antallUbehandlet - 5} flere bilag venter.{" "}
                    <a href="/dashboard/bilag" className="text-primary underline-offset-4 hover:underline">
                      Se alle bilag →
                    </a>
                  </p>
                </SlideIn>
              )}
            </>
          )}
        </div>
      </div>

      {!loading && bilag.length > 0 && (
        <SlideIn direction="up" delay={0.1}>
          <InntektKostnadGraf bilag={bilag} />
        </SlideIn>
      )}

      {!loading && bilag.length > 0 && (
        <>
          <Separator />
          {/* Månedsoversikt */}
          <div>
            <SlideIn direction="up" delay={0.1}>
              <h2 className="mb-4 text-lg font-semibold">Bilag-oversikt per status</h2>
            </SlideIn>
            <StaggerList className="grid gap-3 sm:grid-cols-4" staggerDelay={0.05} initialDelay={0.15}>
              {(["ubehandlet", "foreslått", "bokført", "avvist"] as const).map((status) => {
                const antall = bilag.filter(b => b.status === status).length;
                const totalBelop = bilag.filter(b => b.status === status).reduce((s, b) => s + b.belop, 0);
                const farger: Record<typeof status, string> = {
                  ubehandlet: "text-orange-500",
                  foreslått: "text-blue-500",
                  bokført: "text-green-500",
                  avvist: "text-destructive",
                };
                const label = { ubehandlet: "Ubehandlet", foreslått: "AI-forslag", bokført: "Bokført", avvist: "Avvist" }[status];
                return (
                  <StaggerItem key={status}>
                    <Card className="border-border/50 bg-card/50">
                      <CardHeader className="pb-2">
                        <CardTitle className={`text-sm font-medium ${farger[status]}`}>{label}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1">
                        <p className="text-2xl font-bold">{antall}</p>
                        <p className="text-xs text-muted-foreground">{formatNOK(totalBelop)} totalt</p>
                      </CardContent>
                    </Card>
                  </StaggerItem>
                );
              })}
            </StaggerList>
          </div>
        </>
      )}
    </div>
  );
}
