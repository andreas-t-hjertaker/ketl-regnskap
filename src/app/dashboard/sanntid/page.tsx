"use client";

/**
 * Sanntidsrapporter (#123)
 *
 * Live-oppdaterende KPI-dashboard med Firebase-abonnement.
 * Viser periode-sammenligning (inneværende måned vs. forrige måned),
 * sanntids bilag-aktivitetsstrøm og live MVA-status.
 *
 * Data oppdateres automatisk uten refresh — indikator viser sist synkronisert.
 */

import { useMemo, useState, useEffect } from "react";
import {
  Activity,
  TrendingUp,
  TrendingDown,
  ArrowUp,
  ArrowDown,
  Minus,
  CheckCircle2,
  Clock,
  Bot,
  AlertCircle,
  RefreshCw,
  BarChart3,
  Zap,
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
import { useRapporter } from "@/hooks/use-rapporter";

function formatNOK(v: number) {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);
}

function formatTid(dato: unknown): string {
  if (!dato) return "—";
  let d: Date;
  if (dato instanceof Date) {
    d = dato;
  } else if (typeof dato === "object" && dato !== null && "seconds" in dato) {
    d = new Date((dato as { seconds: number }).seconds * 1000);
  } else {
    return "—";
  }
  const diff = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diff < 1) return "nå nettopp";
  if (diff < 60) return `${diff} min siden`;
  const t = Math.floor(diff / 60);
  if (t < 24) return `${t}t siden`;
  return d.toLocaleDateString("nb-NO");
}

function endringsPil(nå: number, før: number) {
  if (nå === 0 && før === 0) return { ikon: Minus, pst: 0, farge: "text-muted-foreground" };
  if (før === 0) return { ikon: ArrowUp, pst: 100, farge: "text-green-500" };
  const pst = Math.round(((nå - før) / Math.abs(før)) * 100);
  if (pst > 0) return { ikon: ArrowUp, pst, farge: "text-green-500" };
  if (pst < 0) return { ikon: ArrowDown, pst: Math.abs(pst), farge: "text-red-500" };
  return { ikon: Minus, pst: 0, farge: "text-muted-foreground" };
}

function nåværendePeriode(): string {
  const nå = new Date();
  return `${nå.getFullYear()}-${String(nå.getMonth() + 1).padStart(2, "0")}`;
}

function forrigePeriode(): string {
  const nå = new Date();
  nå.setMonth(nå.getMonth() - 1);
  return `${nå.getFullYear()}-${String(nå.getMonth() + 1).padStart(2, "0")}`;
}

const MÅNEDSNAVN: Record<string, string> = {
  "01": "januar", "02": "februar", "03": "mars", "04": "april",
  "05": "mai", "06": "juni", "07": "juli", "08": "august",
  "09": "september", "10": "oktober", "11": "november", "12": "desember",
};

export default function SanntidPage() {
  const { user } = useAuth();
  const { aktivKlientId } = useAktivKlient();
  const { loading, bilag, posteringer, resultatForPeriode, mvaTerminer } = useRapporter(
    user?.uid ?? null,
    aktivKlientId
  );

  const [sistOppdatert, setSistOppdatert] = useState<Date>(new Date());
  const [klokkeTekst, setKlokkeTekst] = useState("");

  // Oppdater "sist oppdatert"-timestamp når bilag endres
  useEffect(() => {
    setSistOppdatert(new Date());
  }, [bilag]);

  // Levende klokke for visning
  useEffect(() => {
    function oppdater() {
      setKlokkeTekst(new Date().toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }
    oppdater();
    const id = setInterval(oppdater, 1000);
    return () => clearInterval(id);
  }, []);

  const nåPeriode = nåværendePeriode();
  const forPeriode = forrigePeriode();

  const nåResultat = resultatForPeriode(nåPeriode);
  const forResultat = resultatForPeriode(forPeriode);

  const nåMåned = MÅNEDSNAVN[nåPeriode.slice(5, 7)] ?? "";
  const forMåned = MÅNEDSNAVN[forPeriode.slice(5, 7)] ?? "";

  // KPIer med sammenligning
  const kpier = useMemo(() => [
    {
      label: "Inntekter",
      nå: nåResultat.totalInntekter,
      før: forResultat.totalInntekter,
      format: "nok" as const,
      ikon: TrendingUp,
    },
    {
      label: "Kostnader",
      nå: nåResultat.totalKostnader,
      før: forResultat.totalKostnader,
      format: "nok" as const,
      ikon: TrendingDown,
    },
    {
      label: "Resultat",
      nå: nåResultat.resultat,
      før: forResultat.resultat,
      format: "nok" as const,
      ikon: BarChart3,
    },
    {
      label: "Bokførte bilag",
      nå: bilag.filter((b) => b.status === "bokført" && b.dato.startsWith(nåPeriode)).length,
      før: bilag.filter((b) => b.status === "bokført" && b.dato.startsWith(forPeriode)).length,
      format: "count" as const,
      ikon: CheckCircle2,
    },
  ], [nåResultat, forResultat, bilag, nåPeriode, forPeriode]);

  // Aktivitetsstrøm: siste 20 bilag sortert etter bilagsnr (proxy for opprettelsestid)
  const aktivitetsstrøm = useMemo(
    () => [...bilag].sort((a, b) => b.bilagsnr - a.bilagsnr).slice(0, 15),
    [bilag]
  );

  // MVA inneværende termin
  const inneværendeTermin = mvaTerminer.at(-1);

  // Posteringsaktivitet per konto-gruppe
  const kontoAktivitet = useMemo(() => {
    const nåPoster = posteringer.filter((p) => p.dato?.startsWith(nåPeriode));
    const grupper = new Map<string, { label: string; antall: number; volum: number }>();
    for (const p of nåPoster) {
      const c = p.kontonr[0];
      const key =
        c === "3" ? "Inntekter (3xxx)"
        : c >= "4" && c <= "8" ? "Kostnader (4–8xxx)"
        : c === "1" ? "Eiendeler (1xxx)"
        : c === "2" ? "Gjeld (2xxx)"
        : "Andre";
      const g = grupper.get(key) ?? { label: key, antall: 0, volum: 0 };
      g.antall++;
      g.volum += p.debet + p.kredit;
      grupper.set(key, g);
    }
    return [...grupper.values()].sort((a, b) => b.volum - a.volum);
  }, [posteringer, nåPeriode]);

  const StatusIkon = {
    bokført: CheckCircle2,
    foreslått: Bot,
    ubehandlet: Clock,
    avvist: AlertCircle,
    kreditert: RefreshCw,
    arkivert: RefreshCw,
  };

  const statusFarger: Record<string, string> = {
    bokført: "text-green-500",
    foreslått: "text-blue-500",
    ubehandlet: "text-orange-500",
    avvist: "text-red-500",
    kreditert: "text-muted-foreground",
    arkivert: "text-muted-foreground",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <SlideIn direction="up" duration={0.4}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Activity className="h-6 w-6 text-green-500" />
              Sanntidsrapporter
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Live KPI-oversikt med automatisk oppdatering fra Firebase.
            </p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1.5 justify-end">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              <span className="text-xs font-medium text-green-600 dark:text-green-400">Live</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono">{klokkeTekst}</p>
            <p className="text-xs text-muted-foreground">
              Synkronisert {formatTid(sistOppdatert)}
            </p>
          </div>
        </div>
      </SlideIn>

      {/* KPI med periode-sammenligning */}
      <SlideIn direction="up" delay={0.05}>
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-amber-500" />
            <p className="text-sm font-medium">
              {nåMåned.charAt(0).toUpperCase() + nåMåned.slice(1)} vs. {forMåned}
            </p>
          </div>
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}
            </div>
          ) : (
            <StaggerList className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" staggerDelay={0.07}>
              {kpier.map((kpi) => {
                const { ikon: PilIkon, pst, farge } = endringsPil(kpi.nå, kpi.før);
                return (
                  <StaggerItem key={kpi.label}>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardDescription className="text-xs">{kpi.label}</CardDescription>
                        <kpi.ikon className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <p className="text-xl font-bold">
                          {kpi.format === "nok" ? formatNOK(kpi.nå) : kpi.nå}
                        </p>
                        <div className="flex items-center gap-1 mt-1">
                          <PilIkon className={`h-3 w-3 ${farge}`} />
                          <span className={`text-xs ${farge}`}>{pst}%</span>
                          <span className="text-xs text-muted-foreground ml-1">
                            vs. {kpi.format === "nok" ? formatNOK(kpi.før) : kpi.før} forrige mnd
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </StaggerItem>
                );
              })}
            </StaggerList>
          )}
        </div>
      </SlideIn>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Live aktivitetsstrøm */}
        <SlideIn direction="up" delay={0.1}>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Activity className="h-4 w-4 text-green-500" />
                  Live bilag-aktivitet
                </CardTitle>
                <Badge variant="outline" className="text-xs font-mono">
                  {bilag.length} bilag
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-1 p-0 pb-4">
              {loading ? (
                <div className="px-6 space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-4 w-4 rounded-full" />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-3 w-40" />
                        <Skeleton className="h-2 w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : aktivitetsstrøm.length === 0 ? (
                <div className="px-6 py-6 text-center text-xs text-muted-foreground">
                  Ingen bilag ennå
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto">
                  {aktivitetsstrøm.map((b, i) => {
                    const Ikon = StatusIkon[b.status];
                    return (
                      <div
                        key={b.id}
                        className={`flex items-start gap-3 px-6 py-2.5 text-sm hover:bg-muted/20 transition-colors ${
                          i < aktivitetsstrøm.length - 1 ? "border-b border-border/30" : ""
                        }`}
                      >
                        <Ikon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${statusFarger[b.status]}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs truncate font-medium">{b.beskrivelse}</p>
                          <p className="text-xs text-muted-foreground">
                            #{b.bilagsnr} · {b.dato}
                            {b.leverandor && ` · ${b.leverandor}`}
                          </p>
                        </div>
                        <span className="text-xs font-mono shrink-0 text-right">
                          {formatNOK(b.belop)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </SlideIn>

        <div className="space-y-4">
          {/* Konto-aktivitet denne måneden */}
          <SlideIn direction="up" delay={0.12}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">
                  Posteringsaktivitet — {nåMåned}
                </CardTitle>
                <CardDescription className="text-xs">
                  Fordeling av posteringslinjer på kontotype
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {loading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8" />)}
                  </div>
                ) : kontoAktivitet.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Ingen posteringer denne måneden</p>
                ) : (
                  kontoAktivitet.map((g) => {
                    const maksPst = kontoAktivitet[0].volum > 0
                      ? (g.volum / kontoAktivitet[0].volum) * 100
                      : 0;
                    return (
                      <div key={g.label} className="space-y-0.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{g.label}</span>
                          <span className="font-mono">{g.antall} linjer · {formatNOK(g.volum)}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted/40">
                          <div
                            className="h-1.5 rounded-full bg-primary/60 transition-all"
                            style={{ width: `${maksPst}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </SlideIn>

          {/* MVA-status */}
          <SlideIn direction="up" delay={0.14}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  MVA — siste termin
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-20" />
                ) : !inneværendeTermin ? (
                  <p className="text-xs text-muted-foreground">Ingen MVA-data ennå.</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">{inneværendeTermin.periode}</p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {[
                        { label: "Utgående MVA", verdi: inneværendeTermin.utgåendeMva, farge: "text-red-600" },
                        { label: "Inngående MVA", verdi: inneværendeTermin.inngåendeMva, farge: "text-green-600" },
                        { label: "Å betale", verdi: inneværendeTermin.åBetale, farge: inneværendeTermin.åBetale > 0 ? "text-amber-600" : "text-green-600" },
                      ].map((m) => (
                        <div key={m.label} className="rounded-md bg-muted/30 p-2">
                          <p className="text-xs text-muted-foreground">{m.label}</p>
                          <p className={`text-sm font-bold ${m.farge}`}>{formatNOK(m.verdi)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </SlideIn>
        </div>
      </div>
    </div>
  );
}
