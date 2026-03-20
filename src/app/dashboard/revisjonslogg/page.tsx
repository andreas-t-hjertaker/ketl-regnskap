"use client";

/**
 * Revisjonslogg — uforanderlig hendelseslogg (audit trail)
 *
 * Viser alle handlinger utført av bruker, AI eller systemet.
 * Iht. Regnskapsloven §§ 8-5 og 10-1 (etterprøvbarhet).
 * Loggen er immutable — oppføringer kan ikke slettes eller redigeres.
 */

import { useState, useMemo } from "react";
import { Shield, User, Bot, Cpu, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SlideIn } from "@/components/motion";
import { useAuth } from "@/hooks/use-auth";
import { useAuditLog, type AuditLogEntry } from "@/hooks/use-audit-log";
import { formatDate } from "@/lib/utils";
import type { AuditHandling } from "@/lib/audit";

const HANDLING_ETIKETT: Record<AuditHandling, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  bilag_opprettet:     { label: "Bilag opprettet", variant: "default" },
  bilag_oppdatert:     { label: "Bilag oppdatert", variant: "secondary" },
  bilag_slettet:       { label: "Bilag slettet", variant: "destructive" },
  bilag_bokfort:       { label: "Bilag bokført", variant: "default" },
  bilag_avvist:        { label: "Bilag avvist", variant: "destructive" },
  bilag_kreditert:     { label: "Bilag kreditert", variant: "outline" },
  bilag_arkivert:      { label: "Bilag arkivert", variant: "secondary" },
  ai_forslag_generert: { label: "AI-forslag generert", variant: "secondary" },
  ai_forslag_godkjent: { label: "AI-forslag godkjent", variant: "default" },
  ai_forslag_avvist:   { label: "AI-forslag avvist", variant: "destructive" },
  klient_opprettet:    { label: "Klient opprettet", variant: "default" },
  klient_oppdatert:    { label: "Klient oppdatert", variant: "secondary" },
  klient_slettet:      { label: "Klient slettet", variant: "destructive" },
  motpart_opprettet:   { label: "Motpart opprettet", variant: "default" },
  motpart_oppdatert:   { label: "Motpart oppdatert", variant: "secondary" },
  motpart_slettet:     { label: "Motpart slettet", variant: "destructive" },
  fil_lastet_opp:      { label: "Fil lastet opp", variant: "secondary" },
  fil_slettet:         { label: "Fil slettet", variant: "destructive" },
};

function UtfortAvIkon({ utfortAv }: { utfortAv: AuditLogEntry["utfortAv"] }) {
  if (utfortAv === "ai") return <Bot className="h-3.5 w-3.5 text-blue-500" />;
  if (utfortAv === "system") return <Cpu className="h-3.5 w-3.5 text-orange-500" />;
  return <User className="h-3.5 w-3.5 text-muted-foreground" />;
}

function tidspunktTilDato(ts: AuditLogEntry["tidspunkt"]): string {
  if (!ts) return "—";
  if (ts instanceof Date) return formatDate(ts.toISOString());
  if (typeof ts === "object" && "seconds" in ts) {
    return formatDate(new Date(ts.seconds * 1000).toISOString());
  }
  return "—";
}

export default function RevisjonsloggPage() {
  const { user } = useAuth();
  const { logg, loading } = useAuditLog(user?.uid ?? null);
  const [søk, setSøk] = useState("");
  const [filterType, setFilterType] = useState<"alle" | "bruker" | "ai" | "system">("alle");

  const filtrert = useMemo(() => {
    const q = søk.toLowerCase().trim();
    return logg.filter((e) => {
      if (filterType !== "alle" && e.utfortAv !== filterType) return false;
      if (!q) return true;
      const etikett = HANDLING_ETIKETT[e.handling]?.label.toLowerCase() ?? "";
      return (
        etikett.includes(q) ||
        e.entitetId.includes(q) ||
        String(e.detaljer?.bilagsnr ?? "").includes(q) ||
        String(e.detaljer?.beskrivelse ?? "").toLowerCase().includes(q)
      );
    });
  }, [logg, filterType, søk]);

  return (
    <div className="space-y-6">
      <SlideIn direction="up" duration={0.4}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Revisjonslogg</h1>
            <p className="text-muted-foreground">
              Komplett hendelseslogg — uforanderlig iht. Regnskapsloven §§ 8-5 og 10-1.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <Badge variant="outline" className="font-mono">{logg.length} oppføringer</Badge>
          </div>
        </div>
      </SlideIn>

      {/* Filter og søk */}
      <SlideIn direction="up" delay={0.05}>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Søk etter handling, bilagsnr eller ID…"
              className="pl-9"
              value={søk}
              onChange={(e) => setSøk(e.target.value)}
            />
          </div>
          <div className="flex gap-1.5">
            {(["alle", "bruker", "ai", "system"] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
                  filterType === type
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:bg-accent/50"
                }`}
              >
                {type === "alle" && "Alle"}
                {type === "bruker" && <><User className="h-3 w-3" />Bruker</>}
                {type === "ai" && <><Bot className="h-3 w-3" />AI</>}
                {type === "system" && <><Cpu className="h-3 w-3" />System</>}
              </button>
            ))}
          </div>
        </div>
      </SlideIn>

      {/* Logg */}
      {loading ? (
        <Card>
          <CardContent className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-3.5 w-3.5 rounded-full" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24 ml-auto" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : filtrert.length === 0 ? (
        <SlideIn direction="up">
          <div className="rounded-xl border border-border/40 py-16 text-center text-muted-foreground">
            <Shield className="mx-auto mb-3 h-8 w-8 opacity-40" />
            <p className="text-sm font-medium">
              {logg.length === 0 ? "Ingen loggoppføringer ennå" : "Ingen treff for søket"}
            </p>
            <p className="text-xs mt-1">
              {logg.length === 0
                ? "Handlinger logges automatisk når du bruker systemet."
                : "Prøv et annet søkeord."}
            </p>
          </div>
        </SlideIn>
      ) : (
        <SlideIn direction="up" delay={0.1}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Siste {filtrert.length} hendelser
              </CardTitle>
              <CardDescription>
                Loggen er immutable — ingen oppføringer kan slettes eller redigeres.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/30">
                {filtrert.map((entry) => {
                  const etikett = HANDLING_ETIKETT[entry.handling] ?? {
                    label: entry.handling,
                    variant: "outline" as const,
                  };
                  return (
                    <div key={entry.id} className="flex items-start gap-3 px-4 py-3 hover:bg-accent/20 transition-colors">
                      <UtfortAvIkon utfortAv={entry.utfortAv} />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={etikett.variant} className="text-xs py-0">
                            {etikett.label}
                          </Badge>
                          {entry.detaljer?.bilagsnr && (
                            <span className="text-xs font-mono text-muted-foreground">
                              #{String(entry.detaljer.bilagsnr)}
                            </span>
                          )}
                          {entry.detaljer?.beskrivelse && (
                            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {String(entry.detaljer.beskrivelse)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {entry.entitetType} · {entry.entitetId.slice(0, 8)}…
                          {entry.utfortAv === "ai" && " · AI"}
                          {entry.utfortAv === "system" && " · System"}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {tidspunktTilDato(entry.tidspunkt)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </SlideIn>
      )}

      {/* Juridisk info */}
      <SlideIn direction="up" delay={0.15}>
        <Card className="bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Lovkrav for revisjonslogg
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <p>
              <strong>Regnskapsloven § 8-5</strong>: Regnskapssystem skal ha sporbarhet
              fra dokumentasjon til regnskap og omvendt.
            </p>
            <p>
              <strong>Regnskapsloven § 10-1</strong>: Regnskapsinformasjon skal
              oppbevares i 5 år etter regnskapsårets slutt. Revisjonsloggen er
              immutable — ingen oppføringer kan slettes.
            </p>
          </CardContent>
        </Card>
      </SlideIn>
    </div>
  );
}
