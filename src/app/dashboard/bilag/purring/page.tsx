"use client";

/**
 * Purring og inkasso — oppfølging av forfalte bilag
 *
 * Viser alle bokførte bilag med satt forfallsdato som er passert.
 * Brukere kan registrere at purring er sendt (1. purring, 2. purring)
 * og markere saken som sendt til inkasso.
 *
 * Purre-statusen lagres på bilaget via useBilag.updateBilag().
 */

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  AlertTriangle,
  Clock,
  MailWarning,
  CheckCircle2,
  Gavel,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SlideIn, StaggerList, StaggerItem } from "@/components/motion";
import { useAuth } from "@/hooks/use-auth";
import { useBilag, type BilagMedId } from "@/hooks/use-bilag";
import { useAktivKlient } from "@/hooks/use-aktiv-klient";
import { useMotparter } from "@/hooks/use-motparter";

function formatNOK(value: number) {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function dagerOverForfall(forfallsDato: string): number {
  return Math.floor(
    (Date.now() - new Date(forfallsDato).getTime()) / 86_400_000
  );
}

type PurringNivå = "uten-purring" | "1-purring" | "2-purring" | "inkasso";

function purringNivå(b: BilagMedId): PurringNivå {
  if (b.purring?.inkasso) return "inkasso";
  if ((b.purring?.antall ?? 0) >= 2) return "2-purring";
  if ((b.purring?.antall ?? 0) === 1) return "1-purring";
  return "uten-purring";
}

function PurringBadge({ nivå }: { nivå: PurringNivå }) {
  const config: Record<PurringNivå, { label: string; className: string }> = {
    "uten-purring": { label: "Ikke purret",    className: "border-amber-500/30 text-amber-600 bg-amber-500/5" },
    "1-purring":    { label: "1. purring",     className: "border-orange-500/30 text-orange-600 bg-orange-500/5" },
    "2-purring":    { label: "2. purring",     className: "border-red-500/30 text-red-600 bg-red-500/5" },
    "inkasso":      { label: "Inkasso",        className: "border-red-700/30 text-red-700 bg-red-700/10" },
  };
  const { label, className } = config[nivå];
  return (
    <Badge variant="outline" className={`text-xs ${className}`}>
      {label}
    </Badge>
  );
}

function BilagKort({
  bilag,
  motpartNavn,
  onRegistrerPurring,
  onSendInkasso,
}: {
  bilag: BilagMedId;
  motpartNavn?: string;
  onRegistrerPurring: (id: string) => void;
  onSendInkasso: (id: string) => void;
}) {
  const dager = bilag.forfallsDato ? dagerOverForfall(bilag.forfallsDato) : 0;
  const nivå = purringNivå(bilag);

  return (
    <Card className={`border-${dager > 60 ? "red" : dager > 30 ? "orange" : "amber"}-500/20`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-base font-semibold">
                #{bilag.bilagsnr} — {bilag.beskrivelse}
              </CardTitle>
              <PurringBadge nivå={nivå} />
            </div>
            {motpartNavn && (
              <CardDescription className="mt-1">{motpartNavn}</CardDescription>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="font-bold">{formatNOK(bilag.belop)}</p>
            <p className="text-xs text-muted-foreground">Bilagsdato: {bilag.dato}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>
                Forfalt: <strong>{bilag.forfallsDato}</strong>
              </span>
            </div>
            <Badge
              variant="outline"
              className={`text-xs ${
                dager > 60
                  ? "border-red-500/30 text-red-600 bg-red-500/5"
                  : dager > 30
                  ? "border-orange-500/30 text-orange-600 bg-orange-500/5"
                  : "border-amber-500/30 text-amber-600 bg-amber-500/5"
              }`}
            >
              {dager} dager over forfall
            </Badge>
            {bilag.purring && (
              <span className="text-xs text-muted-foreground">
                Sist purret: {bilag.purring.sistePurringDato}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {nivå !== "inkasso" && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs h-8"
                onClick={() => onRegistrerPurring(bilag.id)}
                disabled={nivå === "2-purring"}
              >
                <MailWarning className="h-3.5 w-3.5" />
                {nivå === "uten-purring" ? "Registrer 1. purring" : "Registrer 2. purring"}
              </Button>
            )}
            {(nivå === "2-purring") && (
              <Button
                size="sm"
                variant="destructive"
                className="gap-1.5 text-xs h-8"
                onClick={() => onSendInkasso(bilag.id)}
              >
                <Gavel className="h-3.5 w-3.5" />
                Send til inkasso
              </Button>
            )}
            {nivå === "inkasso" && (
              <Badge variant="outline" className="border-red-700/30 text-red-700 gap-1.5 h-8 px-3">
                <Gavel className="h-3.5 w-3.5" />
                Sendt til inkasso
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PurringPage() {
  const { user } = useAuth();
  const { aktivKlient, aktivKlientId } = useAktivKlient();
  const { bilag, loading, updateBilag } = useBilag(user?.uid ?? null, aktivKlientId);
  const { motparter } = useMotparter(user?.uid ?? null, aktivKlientId);
  const [filter, setFilter] = useState<PurringNivå | "alle">("alle");

  const motpartMap = useMemo(
    () => new Map(motparter.map((m) => [m.id, m.navn])),
    [motparter]
  );

  // Bilag med forfallsdato som er passert
  const forfalteBilag = useMemo(() => {
    const nå = new Date().toISOString().slice(0, 10);
    return bilag
      .filter(
        (b) =>
          b.status === "bokført" &&
          b.forfallsDato &&
          b.forfallsDato < nå &&
          !b.kreditertAvId
      )
      .sort((a, b) => (a.forfallsDato ?? "").localeCompare(b.forfallsDato ?? ""));
  }, [bilag]);

  const filtrerte = useMemo(() => {
    if (filter === "alle") return forfalteBilag;
    return forfalteBilag.filter((b) => purringNivå(b) === filter);
  }, [forfalteBilag, filter]);

  // Statistikk
  const stats = useMemo(() => {
    const totalSum = forfalteBilag.reduce((s, b) => s + b.belop, 0);
    const antallInkasso = forfalteBilag.filter((b) => b.purring?.inkasso).length;
    const antallUtenPurring = forfalteBilag.filter((b) => purringNivå(b) === "uten-purring").length;
    return { totalSum, antallInkasso, antallUtenPurring };
  }, [forfalteBilag]);

  async function handleRegistrerPurring(id: string) {
    const b = forfalteBilag.find((x) => x.id === id);
    if (!b) return;
    const antall = (b.purring?.antall ?? 0) + 1;
    await updateBilag(id, {
      purring: {
        antall,
        sistePurringDato: new Date().toISOString().slice(0, 10),
        inkasso: false,
      },
    });
  }

  async function handleSendInkasso(id: string) {
    const b = forfalteBilag.find((x) => x.id === id);
    if (!b) return;
    await updateBilag(id, {
      purring: {
        antall: b.purring?.antall ?? 2,
        sistePurringDato: b.purring?.sistePurringDato ?? new Date().toISOString().slice(0, 10),
        inkasso: true,
      },
    });
  }

  const ingenKlient = !aktivKlient && !aktivKlientId;

  return (
    <div className="space-y-6 max-w-4xl">
      <SlideIn direction="up" duration={0.4}>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/bilag">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Purring og inkasso</h1>
            <p className="text-muted-foreground text-sm">
              Bokførte bilag med passert forfallsdato — oppfølging og inkasso.
            </p>
          </div>
        </div>
      </SlideIn>

      {/* Ingen klient */}
      {ingenKlient && (
        <SlideIn direction="up">
          <div className="rounded-xl border border-border/40 py-12 text-center text-muted-foreground">
            <Building2 className="mx-auto mb-3 h-8 w-8 opacity-40" />
            <p className="text-sm font-medium">Velg en klient i sidemenyen</p>
          </div>
        </SlideIn>
      )}

      {!ingenKlient && !loading && (
        <>
          {/* Statistikk */}
          {forfalteBilag.length > 0 && (
            <SlideIn direction="up" delay={0.05}>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  {
                    label: "Totalt forfalt",
                    value: formatNOK(stats.totalSum),
                    icon: AlertTriangle,
                    color: "text-red-500",
                  },
                  {
                    label: "Ikke purret ennå",
                    value: `${stats.antallUtenPurring} bilag`,
                    icon: MailWarning,
                    color: "text-amber-500",
                  },
                  {
                    label: "Til inkasso",
                    value: `${stats.antallInkasso} bilag`,
                    icon: Gavel,
                    color: "text-red-600",
                  },
                ].map((s) => (
                  <Card key={s.label}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardDescription className="text-xs font-medium uppercase tracking-wide">
                        {s.label}
                      </CardDescription>
                      <s.icon className={`h-4 w-4 ${s.color}`} />
                    </CardHeader>
                    <CardContent>
                      <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </SlideIn>
          )}

          {/* Filter */}
          {forfalteBilag.length > 0 && (
            <SlideIn direction="up" delay={0.1}>
              <div className="flex flex-wrap gap-1.5">
                {(["alle", "uten-purring", "1-purring", "2-purring", "inkasso"] as const).map(
                  (f) => (
                    <Button
                      key={f}
                      size="sm"
                      variant={filter === f ? "default" : "outline"}
                      className="h-7 text-xs"
                      onClick={() => setFilter(f)}
                    >
                      {f === "alle"
                        ? `Alle (${forfalteBilag.length})`
                        : f === "uten-purring"
                        ? "Ikke purret"
                        : f === "1-purring"
                        ? "1. purring"
                        : f === "2-purring"
                        ? "2. purring"
                        : "Inkasso"}
                    </Button>
                  )
                )}
              </div>
            </SlideIn>
          )}

          {/* Tom tilstand */}
          {forfalteBilag.length === 0 && (
            <SlideIn direction="up">
              <div className="rounded-xl border border-border/40 py-16 text-center text-muted-foreground">
                <CheckCircle2 className="mx-auto mb-3 h-8 w-8 opacity-40 text-green-500" />
                <p className="text-sm font-medium">Ingen forfalte bilag</p>
                <p className="text-xs mt-1">
                  Legg til forfallsdato på bilag for å følge opp ubetalt gjeld.
                </p>
              </div>
            </SlideIn>
          )}

          {/* Liste */}
          {filtrerte.length > 0 && (
            <StaggerList className="space-y-3" staggerDelay={0.06}>
              {filtrerte.map((b) => (
                <StaggerItem key={b.id}>
                  <BilagKort
                    bilag={b}
                    motpartNavn={b.motpartId ? motpartMap.get(b.motpartId) : undefined}
                    onRegistrerPurring={handleRegistrerPurring}
                    onSendInkasso={handleSendInkasso}
                  />
                </StaggerItem>
              ))}
            </StaggerList>
          )}

          {filtrerte.length === 0 && forfalteBilag.length > 0 && (
            <SlideIn direction="up">
              <div className="rounded-xl border border-border/40 py-8 text-center text-muted-foreground">
                <p className="text-sm">Ingen bilag i valgt filter.</p>
              </div>
            </SlideIn>
          )}
        </>
      )}
    </div>
  );
}
