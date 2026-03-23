"use client";

/**
 * Godkjenningskø (#128)
 *
 * Viser alle bilag som er i en aktiv godkjenningsprosess.
 * Brukeren kan attestere (bekrefte saklighet) og anvis (godkjenne betaling).
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCheck,
  XCircle,
  ClipboardCheck,
  ArrowLeft,
  UserCheck,
  BadgeCheck,
  Clock,
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
import { useBilag } from "@/hooks/use-bilag";
import { useGodkjenning } from "@/hooks/use-godkjenning";
import type { GodkjenningTrinnStatus } from "@/types";

const TRINN_CFG: Record<
  GodkjenningTrinnStatus,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  venter:   { label: "Venter",   variant: "outline" },
  godkjent: { label: "Godkjent", variant: "default" },
  avvist:   { label: "Avvist",   variant: "destructive" },
};

function formatNOK(v: number) {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);
}

export default function GodkjenningPage() {
  const { user } = useAuth();
  const { aktivKlientId } = useAktivKlient();
  const { bilag, loading } = useBilag(user?.uid ?? null, aktivKlientId);
  const { attester, anvis, avvisGodkjenning } = useGodkjenning(user?.uid ?? null);
  const [kommentar, setKommentar] = useState<Record<string, string>>({});

  // Filtrer bilag med aktiv godkjenningskjede
  const køBilag = useMemo(
    () =>
      bilag.filter(
        (b) => b.godkjenning && !b.godkjenning.ferdig
      ),
    [bilag]
  );

  const ferdigBilag = useMemo(
    () =>
      bilag
        .filter((b) => b.godkjenning?.ferdig)
        .slice(0, 20),
    [bilag]
  );

  return (
    <div className="space-y-6">
      <SlideIn direction="up" duration={0.4}>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/bilag">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <ClipboardCheck className="h-6 w-6" />
              Godkjenningskø
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Bilag som venter på attestasjon og/eller anvisning.
            </p>
          </div>
        </div>
      </SlideIn>

      {/* KPI */}
      <SlideIn direction="up" delay={0.05}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">I kø</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{loading ? "—" : køBilag.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">Venter på attestasjon</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {loading ? "—" : køBilag.filter(
                  (b) => b.godkjenning?.attestasjon?.status === "venter"
                ).length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">Venter på anvisning</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {loading ? "—" : køBilag.filter(
                  (b) =>
                    b.godkjenning?.attestasjon?.status !== "venter" &&
                    b.godkjenning?.anvisning?.status === "venter"
                ).length}
              </p>
            </CardContent>
          </Card>
        </div>
      </SlideIn>

      {/* Aktiv kø */}
      <SlideIn direction="up" delay={0.1}>
        <div className="space-y-3">
          <h2 className="text-base font-semibold">Venter på godkjenning</h2>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-28" />
              ))}
            </div>
          ) : køBilag.length === 0 ? (
            <div className="rounded-xl border border-border/40 py-12 text-center text-muted-foreground">
              <CheckCheck className="mx-auto mb-3 h-7 w-7 opacity-40" />
              <p className="text-sm font-medium">Ingen bilag venter på godkjenning</p>
            </div>
          ) : (
            <div className="space-y-3">
              {køBilag.map((b) => {
                const kjede = b.godkjenning!;
                const attestStatus = kjede.attestasjon?.status ?? "venter";
                const anvisStatus = kjede.anvisning?.status ?? null;
                const kom = kommentar[b.id] ?? "";

                // Attestasjon kan gjøres nå?
                const kanAttestere = attestStatus === "venter";
                // Anvisning kan gjøres etter attestasjon (eller om det ikke er attestasjon)
                const kanAnvise =
                  anvisStatus === "venter" && attestStatus !== "venter";

                return (
                  <Card key={b.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-sm">
                            #{b.bilagsnr} — {b.beskrivelse}
                          </CardTitle>
                          <CardDescription className="text-xs mt-0.5">
                            {b.leverandor && `${b.leverandor} · `}
                            {b.dato} · {formatNOK(b.belop)}
                          </CardDescription>
                        </div>
                        <div className="flex gap-1.5 flex-wrap justify-end">
                          {kjede.attestasjon && (
                            <Badge
                              variant={TRINN_CFG[attestStatus].variant}
                              className="gap-1 text-xs"
                            >
                              <UserCheck className="h-3 w-3" />
                              Att.: {TRINN_CFG[attestStatus].label}
                            </Badge>
                          )}
                          {kjede.anvisning && anvisStatus && (
                            <Badge
                              variant={TRINN_CFG[anvisStatus].variant}
                              className="gap-1 text-xs"
                            >
                              <BadgeCheck className="h-3 w-3" />
                              Anv.: {TRINN_CFG[anvisStatus].label}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <input
                        type="text"
                        placeholder="Kommentar (valgfritt)…"
                        value={kom}
                        onChange={(e) =>
                          setKommentar((prev) => ({ ...prev, [b.id]: e.target.value }))
                        }
                        className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
                      />
                      <div className="flex flex-wrap gap-2">
                        {kanAttestere && (
                          <>
                            <Button
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => attester(b.id, kjede, kom || undefined)}
                            >
                              <UserCheck className="h-3 w-3 mr-1" />
                              Attester
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs text-destructive border-destructive/30"
                              onClick={() =>
                                avvisGodkjenning(b.id, kjede, "attestasjon", kom || undefined)
                              }
                            >
                              <XCircle className="h-3 w-3 mr-1" />
                              Avvis
                            </Button>
                          </>
                        )}
                        {kanAnvise && (
                          <>
                            <Button
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => anvis(b.id, kjede, kom || undefined)}
                            >
                              <BadgeCheck className="h-3 w-3 mr-1" />
                              Anvis
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs text-destructive border-destructive/30"
                              onClick={() =>
                                avvisGodkjenning(b.id, kjede, "anvisning", kom || undefined)
                              }
                            >
                              <XCircle className="h-3 w-3 mr-1" />
                              Avvis
                            </Button>
                          </>
                        )}
                        {!kanAttestere && !kanAnvise && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Venter på neste trinn…
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </SlideIn>

      {/* Ferdig behandlede */}
      {ferdigBilag.length > 0 && (
        <SlideIn direction="up" delay={0.15}>
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-muted-foreground">
              Ferdig behandlet (siste 20)
            </h2>
            <div className="space-y-2">
              {ferdigBilag.map((b) => {
                const kjede = b.godkjenning!;
                const avvist =
                  kjede.attestasjon?.status === "avvist" ||
                  kjede.anvisning?.status === "avvist";
                return (
                  <div
                    key={b.id}
                    className="flex items-center justify-between rounded-lg border border-border/40 px-4 py-2 text-sm"
                  >
                    <span className="font-medium">
                      #{b.bilagsnr} — {b.beskrivelse}
                    </span>
                    <Badge variant={avvist ? "destructive" : "default"} className="text-xs">
                      {avvist ? "Avvist" : "Godkjent"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        </SlideIn>
      )}
    </div>
  );
}
