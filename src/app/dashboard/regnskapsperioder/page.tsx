"use client";

/**
 * Regnskapsperioder (#116)
 *
 * Viser en månedsgrid per år. Brukeren kan:
 * - Låse en periode (ingen nye bilag kan bokføres)
 * - Lukke en periode endelig
 * - Gjenåpne en låst periode
 *
 * Kontrollsjekk: viser antall ubehandlede/foreslåtte bilag i perioden
 * før lukking slik at ingenting glipper.
 */

import { useState, useMemo } from "react";
import {
  Lock,
  LockOpen,
  CheckCheck,
  CalendarDays,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
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
import { SlideIn } from "@/components/motion";
import { useAuth } from "@/hooks/use-auth";
import { useAktivKlient } from "@/hooks/use-aktiv-klient";
import { useRegnskapsperioder } from "@/hooks/use-regnskapsperioder";
import { useBilag } from "@/hooks/use-bilag";
import type { PeriodeStatus } from "@/types";

const MÅNEDSNAVN = [
  "Januar", "Februar", "Mars", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Desember",
];

const STATUS_CFG: Record<
  PeriodeStatus,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive"; color: string }
> = {
  åpen:   { label: "Åpen",   variant: "outline",     color: "text-green-600 dark:text-green-400" },
  låst:   { label: "Låst",   variant: "secondary",   color: "text-amber-600 dark:text-amber-400" },
  lukket: { label: "Lukket", variant: "destructive", color: "text-muted-foreground" },
};

function PeriodKort({
  år,
  måned,
  status,
  bilagIperioden,
  ubehandlet,
  onLås,
  onLukk,
  onÅpne,
}: {
  år: number;
  måned: number;
  status: PeriodeStatus;
  bilagIperioden: number;
  ubehandlet: number;
  onLås: () => void;
  onLukk: () => void;
  onÅpne: () => void;
}) {
  const cfg = STATUS_CFG[status];
  const nøkkel = `${år}-${String(måned).padStart(2, "0")}`;
  const erFremtid = new Date() < new Date(år, måned - 1, 1);

  return (
    <Card className={`transition-colors ${status === "lukket" ? "opacity-70" : ""}`}>
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            {MÅNEDSNAVN[måned - 1]}
          </CardTitle>
          <Badge variant={cfg.variant} className="text-xs">
            {cfg.label}
          </Badge>
        </div>
        <CardDescription className="text-xs font-mono">{nøkkel}</CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-2">
        <div className="text-xs text-muted-foreground">
          {bilagIperioden} bilag
          {ubehandlet > 0 && (
            <span className="ml-2 text-amber-600 dark:text-amber-400 font-medium">
              · {ubehandlet} ubehandlet
            </span>
          )}
        </div>

        {ubehandlet > 0 && status !== "åpen" && (
          <div className="flex items-start gap-1.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-2 py-1.5">
            <AlertTriangle className="h-3 w-3 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {ubehandlet} ubehandlet bilag i perioden
            </p>
          </div>
        )}

        {!erFremtid && (
          <div className="flex flex-wrap gap-1 pt-1">
            {status === "åpen" && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onLås}>
                <Lock className="h-3 w-3 mr-1" />
                Lås
              </Button>
            )}
            {status === "åpen" && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/5"
                onClick={onLukk}
                disabled={ubehandlet > 0}
                title={ubehandlet > 0 ? "Behandle alle bilag før lukking" : undefined}
              >
                <CheckCheck className="h-3 w-3 mr-1" />
                Lukk periode
              </Button>
            )}
            {status === "låst" && (
              <>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onÅpne}>
                  <LockOpen className="h-3 w-3 mr-1" />
                  Gjenåpne
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/5"
                  onClick={onLukk}
                  disabled={ubehandlet > 0}
                  title={ubehandlet > 0 ? "Behandle alle bilag før lukking" : undefined}
                >
                  <CheckCheck className="h-3 w-3 mr-1" />
                  Lukk endelig
                </Button>
              </>
            )}
            {status === "lukket" && (
              <p className="text-xs text-muted-foreground italic">
                Perioden er endelig lukket.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function RegnskapsperioderPage() {
  const { user } = useAuth();
  const { aktivKlientId } = useAktivKlient();
  const { perioder, loading, hentStatus, låsPeriode, lukkPeriode, åpnePeriode } =
    useRegnskapsperioder(user?.uid ?? null, aktivKlientId);
  const { bilag } = useBilag(user?.uid ?? null, aktivKlientId);

  const dagensDato = new Date();
  const [visÅr, setVisÅr] = useState(dagensDato.getFullYear());

  /** Bilag per periode-nøkkel (YYYY-MM) */
  const bilagPerPeriode = useMemo(() => {
    const map: Record<string, { totalt: number; ubehandlet: number }> = {};
    for (const b of bilag) {
      if (!b.dato) continue;
      const nøkkel = b.dato.slice(0, 7); // "YYYY-MM"
      if (!map[nøkkel]) map[nøkkel] = { totalt: 0, ubehandlet: 0 };
      map[nøkkel].totalt++;
      if (b.status === "ubehandlet" || b.status === "foreslått") {
        map[nøkkel].ubehandlet++;
      }
    }
    return map;
  }, [bilag]);

  const måneder = Array.from({ length: 12 }, (_, i) => i + 1);

  const antallLåste = perioder.filter((p) => p.år === visÅr && p.status === "låst").length;
  const antallLukkede = perioder.filter((p) => p.år === visÅr && p.status === "lukket").length;

  return (
    <div className="space-y-6">
      <SlideIn direction="up" duration={0.4}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <CalendarDays className="h-6 w-6" />
              Regnskapsperioder
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Lås og lukk regnskapsperioder (måneder) for å forhindre uønsket bokføring.
              Etter lukking er perioden endelig og kan ikke gjenåpnes.
            </p>
          </div>
        </div>
      </SlideIn>

      {/* KPI-rad */}
      <SlideIn direction="up" delay={0.05}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">Åpne perioder ({visÅr})</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {loading ? "—" : 12 - antallLåste - antallLukkede}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">Låste perioder ({visÅr})</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {loading ? "—" : antallLåste}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">Lukkede perioder ({visÅr})</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-muted-foreground">
                {loading ? "—" : antallLukkede}
              </p>
            </CardContent>
          </Card>
        </div>
      </SlideIn>

      {/* År-velger */}
      <SlideIn direction="up" delay={0.1}>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setVisÅr((y) => y - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-lg font-semibold w-16 text-center">{visÅr}</span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setVisÅr((y) => y + 1)}
            disabled={visÅr >= dagensDato.getFullYear() + 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </SlideIn>

      {/* Månedsgrid */}
      <SlideIn direction="up" delay={0.15}>
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {måneder.map((m) => (
              <Skeleton key={m} className="h-32" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {måneder.map((måned) => {
              const nøkkel = `${visÅr}-${String(måned).padStart(2, "0")}`;
              const status = hentStatus(visÅr, måned);
              const stats = bilagPerPeriode[nøkkel] ?? { totalt: 0, ubehandlet: 0 };
              return (
                <PeriodKort
                  key={nøkkel}
                  år={visÅr}
                  måned={måned}
                  status={status}
                  bilagIperioden={stats.totalt}
                  ubehandlet={stats.ubehandlet}
                  onLås={() => låsPeriode(visÅr, måned)}
                  onLukk={() => lukkPeriode(visÅr, måned)}
                  onÅpne={() => åpnePeriode(visÅr, måned)}
                />
              );
            })}
          </div>
        )}
      </SlideIn>

      {/* Forklaring */}
      <SlideIn direction="up" delay={0.2}>
        <Card className="border-border/40 bg-muted/20">
          <CardContent className="pt-4 pb-4">
            <div className="grid gap-3 sm:grid-cols-3 text-sm">
              <div className="flex items-start gap-2">
                <LockOpen className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Åpen</p>
                  <p className="text-xs text-muted-foreground">Bokføring tillatt. Standard for alle perioder.</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Lock className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Låst</p>
                  <p className="text-xs text-muted-foreground">
                    Ingen nye bilag kan bokføres. Kan gjenåpnes ved behov.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCheck className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Lukket</p>
                  <p className="text-xs text-muted-foreground">
                    Endelig avsluttet (Bokfl. § 7). Kan ikke gjenåpnes.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </SlideIn>
    </div>
  );
}
