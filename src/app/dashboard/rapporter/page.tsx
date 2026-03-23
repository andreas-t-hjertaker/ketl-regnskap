"use client";

import { useState, useMemo } from "react";
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
  Users,
  Truck,
  ChevronDown,
  ChevronRight,
  ArrowUpDown,
} from "lucide-react";
import { SlideIn, StaggerList, StaggerItem } from "@/components/motion";
import { useAuth } from "@/hooks/use-auth";
import { useRapporter } from "@/hooks/use-rapporter";
import { useAktivKlient } from "@/hooks/use-aktiv-klient";
import { useMotparter } from "@/hooks/use-motparter";
import { useReskontro, type ReskontroPoster, type ÅpenPost, type AldersBøtte } from "@/hooks/use-reskontro";
import { lastNedSaftXml, saftMetadata, genererSaftXml, validerSaftXml, type SaftValideringsFunn } from "@/lib/saft-eksport";
import { eksporterResultatCsv } from "@/lib/eksport";

type Fane = "resultat" | "balanse" | "kontantstrøm" | "mva" | "reskontro" | "saft";

function formatNOK(value: number) {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function genererPerioder(bilagDatoer: string[]) {
  const måneder = new Set(bilagDatoer.map((d) => d.slice(0, 7)));
  const år = new Set(bilagDatoer.map((d) => d.slice(0, 4)));
  const sorterte = [...måneder].sort();
  const formatter = new Intl.DateTimeFormat("nb-NO", { month: "long", year: "numeric" });

  const månedAlternativer = sorterte.map((m) => ({
    key: m,
    label: formatter.format(new Date(m + "-01")),
  }));

  const årAlternativer = [...år].sort().map((å) => ({
    key: å,
    label: `Hele ${å}`,
  }));

  return [...månedAlternativer, ...årAlternativer, { key: "alt", label: "Alle perioder" }];
}

// ─── Reskontro-hjelpefunksjoner ───────────────────────────────────────────────

const ALDERSBØTTE_FARGER: Record<AldersBøtte, string> = {
  "0-30":  "text-green-600 bg-green-500/10",
  "31-60": "text-yellow-600 bg-yellow-500/10",
  "61-90": "text-orange-600 bg-orange-500/10",
  "91+":   "text-red-600 bg-red-500/10",
};

const ALDERSBØTTE_ETIKETTER: Record<AldersBøtte, string> = {
  "0-30":  "0–30 dager",
  "31-60": "31–60 dager",
  "61-90": "61–90 dager",
  "91+":   "91+ dager",
};

function ReskontroPosterKort({
  post,
  type,
}: {
  post: ReskontroPoster;
  type: "kunde" | "leverandor";
}) {
  const [åpen, setÅpen] = useState(false);
  const aldresBøtter: AldersBøtte[] = ["0-30", "31-60", "61-90", "91+"];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {type === "kunde" ? (
              <Users className="h-4 w-4 text-muted-foreground shrink-0" />
            ) : (
              <Truck className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <div>
              <CardTitle className="text-base">{post.motpartNavn}</CardTitle>
              {post.orgnr && (
                <CardDescription className="font-mono text-xs">
                  {post.orgnr}
                </CardDescription>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="font-bold text-base">{formatNOK(post.totalBelop)}</p>
            <p className="text-xs text-muted-foreground">
              {post.åpnePoster.length} bilag
            </p>
          </div>
        </div>
        {/* Aldersfordeling-bar */}
        <div className="grid grid-cols-4 gap-1 mt-2">
          {aldresBøtter.map((b) => (
            <div key={b} className={`rounded px-2 py-1 text-xs ${ALDERSBØTTE_FARGER[b]}`}>
              <p className="font-medium">{formatNOK(post.aldersfordeling[b])}</p>
              <p className="opacity-70">{ALDERSBØTTE_ETIKETTER[b]}</p>
            </div>
          ))}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => setÅpen(!åpen)}
        >
          {åpen ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          {åpen ? "Skjul" : "Vis"} poster
        </Button>
        {åpen && (
          <table className="w-full text-sm mt-2">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-1.5 px-2 text-xs font-medium text-muted-foreground">Bilag#</th>
                <th className="text-left py-1.5 px-2 text-xs font-medium text-muted-foreground">Dato</th>
                <th className="text-left py-1.5 px-2 text-xs font-medium text-muted-foreground">Beskrivelse</th>
                <th className="text-right py-1.5 px-2 text-xs font-medium text-muted-foreground">Beløp</th>
                <th className="text-right py-1.5 px-2 text-xs font-medium text-muted-foreground">Alder</th>
              </tr>
            </thead>
            <tbody>
              {post.åpnePoster.map((p) => (
                <tr key={p.bilagId} className="border-b border-border/20">
                  <td className="py-1.5 px-2 font-mono text-xs text-muted-foreground">
                    #{p.bilagsnr}
                  </td>
                  <td className="py-1.5 px-2 text-xs">{p.dato}</td>
                  <td className="py-1.5 px-2 max-w-[200px] truncate text-xs">{p.beskrivelse}</td>
                  <td className="py-1.5 px-2 text-right font-medium">{formatNOK(p.belop)}</td>
                  <td className="py-1.5 px-2 text-right">
                    <Badge
                      variant="outline"
                      className={`text-xs ${ALDERSBØTTE_FARGER[p.aldersBøtte]}`}
                    >
                      {p.dagerGammel} dager
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

function UfiltrertePostListe({ poster, tittel }: { poster: ÅpenPost[]; tittel: string }) {
  if (poster.length === 0) return null;
  return (
    <Card className="border-muted/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{tittel}</CardTitle>
        <CardDescription className="text-xs">
          Disse bilagene har ikke tilknyttet motpart.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <tbody>
            {poster.map((p) => (
              <tr key={p.bilagId} className="border-t border-border/20">
                <td className="py-2 px-4 font-mono text-xs text-muted-foreground">#{p.bilagsnr}</td>
                <td className="py-2 px-2 text-xs">{p.dato}</td>
                <td className="py-2 px-2 truncate max-w-[200px] text-xs">{p.beskrivelse}</td>
                <td className="py-2 px-4 text-right font-medium">{formatNOK(p.belop)}</td>
                <td className="py-2 px-4 text-right">
                  <Badge variant="outline" className={`text-xs ${ALDERSBØTTE_FARGER[p.aldersBøtte]}`}>
                    {p.dagerGammel} dager
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function ReskontroFane({ reskontro }: { reskontro: ReturnType<typeof useReskontro> }) {
  const [aktivReskontroFane, setAktivReskontroFane] = useState<"kunder" | "leverandorer">("kunder");

  const ingenData =
    reskontro.kundefordringer.length === 0 &&
    reskontro.leverandørgjeld.length === 0 &&
    reskontro.ufiltrerteKundebilag.length === 0 &&
    reskontro.ufiltrerteLevebilag.length === 0;

  if (ingenData) {
    return (
      <SlideIn direction="up">
        <div className="rounded-xl border border-border/40 py-16 text-center text-muted-foreground">
          <Users className="mx-auto mb-3 h-8 w-8 opacity-40" />
          <p className="text-sm font-medium">Ingen reskontrodata</p>
          <p className="text-xs mt-1">
            Bokfør bilag med konto 1500 (kundefordringer) eller 2400 (leverandørgjeld)
            og knytt dem til en motpart for å se reskontro.
          </p>
        </div>
      </SlideIn>
    );
  }

  const vistePoster =
    aktivReskontroFane === "kunder"
      ? reskontro.kundefordringer
      : reskontro.leverandørgjeld;
  const ufiltrerteViste =
    aktivReskontroFane === "kunder"
      ? reskontro.ufiltrerteKundebilag
      : reskontro.ufiltrerteLevebilag;
  const totalVist =
    aktivReskontroFane === "kunder"
      ? reskontro.totalKundefordringer
      : reskontro.totalLeverandørgjeld;

  return (
    <div className="space-y-4">
      {/* Totaler */}
      <StaggerList className="grid gap-4 sm:grid-cols-2" staggerDelay={0.07}>
        {[
          {
            label: "Totale kundefordringer",
            value: reskontro.totalKundefordringer,
            icon: Users,
            color: "text-blue-600",
          },
          {
            label: "Total leverandørgjeld",
            value: reskontro.totalLeverandørgjeld,
            icon: Truck,
            color: "text-purple-600",
          },
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

      {/* Faner */}
      <div className="flex gap-1 rounded-lg border border-border/50 p-1 w-fit">
        <Button
          variant={aktivReskontroFane === "kunder" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setAktivReskontroFane("kunder")}
          className="gap-1.5"
        >
          <Users className="h-3.5 w-3.5" />
          Kundefordringer
          <Badge variant="secondary" className="ml-1 text-xs px-1.5">
            {reskontro.kundefordringer.length}
          </Badge>
        </Button>
        <Button
          variant={aktivReskontroFane === "leverandorer" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setAktivReskontroFane("leverandorer")}
          className="gap-1.5"
        >
          <Truck className="h-3.5 w-3.5" />
          Leverandørgjeld
          <Badge variant="secondary" className="ml-1 text-xs px-1.5">
            {reskontro.leverandørgjeld.length}
          </Badge>
        </Button>
      </div>

      {/* Sammendrag + total */}
      {totalVist > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {vistePoster.length} {aktivReskontroFane === "kunder" ? "kunder" : "leverandører"} med åpne poster
          </span>
          <span className="font-semibold">{formatNOK(totalVist)} totalt</span>
        </div>
      )}

      {/* Liste per motpart */}
      {vistePoster.length > 0 && (
        <div className="space-y-3">
          {vistePoster.map((post, i) => (
            <SlideIn key={post.motpartId} direction="up" delay={i * 0.04}>
              <ReskontroPosterKort
                post={post}
                type={aktivReskontroFane === "kunder" ? "kunde" : "leverandor"}
              />
            </SlideIn>
          ))}
        </div>
      )}

      <UfiltrertePostListe
        poster={ufiltrerteViste}
        tittel={
          aktivReskontroFane === "kunder"
            ? "Bilag med konto 1500 uten tilknyttet kunde"
            : "Bilag med konto 2400 uten tilknyttet leverandør"
        }
      />

      {totalVist === 0 && (
        <SlideIn direction="up">
          <div className="rounded-xl border border-border/40 py-12 text-center text-muted-foreground">
            {aktivReskontroFane === "kunder" ? (
              <Users className="mx-auto mb-3 h-8 w-8 opacity-40" />
            ) : (
              <Truck className="mx-auto mb-3 h-8 w-8 opacity-40" />
            )}
            <p className="text-sm">
              Ingen {aktivReskontroFane === "kunder" ? "kundefordringer" : "leverandørgjeld"} funnet.
            </p>
          </div>
        </SlideIn>
      )}
    </div>
  );
}

export default function RapporterPage() {
  const { user } = useAuth();
  const { aktivKlient, aktivKlientId } = useAktivKlient();
  const { loading, bilag, resultatForPeriode, kontantstrømForPeriode, balanse, mvaTerminer } = useRapporter(
    user?.uid ?? null,
    aktivKlientId
  );
  const { motparter } = useMotparter(user?.uid ?? null, aktivKlientId);
  const reskontro = useReskontro(bilag, motparter);
  const [genererSaft, setGenererSaft] = useState(false);
  const [saftValidering, setSaftValidering] = useState<{ gyldig: boolean; funn: SaftValideringsFunn[] } | null>(null);
  const periodeAlternativer = useMemo(
    () => genererPerioder(bilag.map((b) => b.dato)),
    [bilag]
  );
  const [valgtPeriode, setValgtPeriode] = useState(() => {
    const nå = new Date();
    return `${nå.getFullYear()}-${String(nå.getMonth() + 1).padStart(2, "0")}`;
  });
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
          {aktivFane === "resultat" && !ingenData && (
            <Button
              variant="outline"
              onClick={() => eksporterResultatCsv(resultat, valgtPeriode)}
            >
              <Download className="mr-2 h-4 w-4" />
              Eksporter CSV
            </Button>
          )}
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
            { id: "kontantstrøm" as Fane, label: "Kontantstrøm", icon: ArrowUpDown },
            { id: "mva" as Fane, label: "MVA-rapport", icon: FileText },
            { id: "reskontro" as Fane, label: "Reskontro", icon: Users },
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

      {/* Reskontro */}
      {!loading && aktivFane === "reskontro" && (
        <ReskontroFane reskontro={reskontro} />
      )}

      {/* Kontantstrømoppstilling — indirekte metode (#124) */}
      {!loading && aktivFane === "kontantstrøm" && (() => {
        const ks = kontantstrømForPeriode(valgtPeriode);

        function KontantstrømSeksjon({
          tittel,
          linjer,
        }: {
          tittel: string;
          linjer: { label: string; belop: number; erTotal?: boolean }[];
        }) {
          return (
            <div className="space-y-0">
              <div className="bg-muted/40 px-4 py-2 rounded-t-md">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {tittel}
                </p>
              </div>
              {linjer.map((linje, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between px-4 py-2 text-sm border-x border-b border-border/40 ${
                    linje.erTotal
                      ? "bg-muted/20 font-semibold border-t border-border/60"
                      : "hover:bg-muted/10"
                  } ${i === linjer.length - 1 ? "rounded-b-md" : ""}`}
                >
                  <span className={linje.erTotal ? "" : "text-muted-foreground"}>
                    {linje.label}
                  </span>
                  <span
                    className={`font-mono text-right min-w-[120px] ${
                      linje.belop >= 0
                        ? linje.erTotal
                          ? "text-green-700 dark:text-green-400"
                          : ""
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {formatNOK(linje.belop)}
                  </span>
                </div>
              ))}
            </div>
          );
        }

        return (
          <SlideIn direction="up">
            <div className="space-y-4">
              {/* KPI-rad */}
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { label: "Kontantstrøm fra drift", belop: ks.nettoDrift, icon: TrendingUp },
                  { label: "Kontantstrøm fra investering", belop: ks.nettoInvestering, icon: BarChart3 },
                  { label: "Netto endring i kontanter", belop: ks.nettoEndring, icon: ArrowUpDown },
                ].map((s) => (
                  <Card key={s.label}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardDescription className="text-xs">{s.label}</CardDescription>
                      <s.icon className={`h-4 w-4 ${s.belop >= 0 ? "text-green-500" : "text-red-500"}`} />
                    </CardHeader>
                    <CardContent>
                      <p className={`text-xl font-bold ${s.belop >= 0 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {formatNOK(s.belop)}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ArrowUpDown className="h-4 w-4" />
                    Kontantstrømoppstilling — indirekte metode
                  </CardTitle>
                  <CardDescription>
                    Iht. Regnskapsloven § 6-4. Beregnet fra bokførte posteringer for valgt periode.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <KontantstrømSeksjon
                    tittel="A. Kontantstrøm fra operasjonelle aktiviteter"
                    linjer={ks.operasjonell}
                  />
                  <KontantstrømSeksjon
                    tittel="B. Kontantstrøm fra investeringsaktiviteter"
                    linjer={ks.investering}
                  />
                  <KontantstrømSeksjon
                    tittel="C. Kontantstrøm fra finansieringsaktiviteter"
                    linjer={ks.finansiering}
                  />

                  {/* Netto totalsum */}
                  <div className="flex items-center justify-between rounded-lg bg-primary/5 border border-primary/20 px-4 py-3">
                    <span className="font-semibold text-sm">
                      Netto endring i kontanter og kontantekvivalenter (A+B+C)
                    </span>
                    <span
                      className={`font-mono font-bold text-base min-w-[120px] text-right ${
                        ks.nettoEndring >= 0
                          ? "text-green-700 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {formatNOK(ks.nettoEndring)}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Merk: Kontantstrømoppstillingen beregnes automatisk fra dobbelbokholderi-posteringer.
                    For fullstendig kontantstrøm kreves IB-kontantbeholdning fra forrige periode.
                  </p>
                </CardContent>
              </Card>
            </div>
          </SlideIn>
        );
      })()}

      {/* SAF-T */}
      {!loading && aktivFane === "saft" && (() => {
        const meta = saftMetadata(bilag);
        const kanEksportere = meta.antallBilag > 0 && aktivKlient !== null;
        return (
          <SlideIn direction="up">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <FileBarChart className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">SAF-T Financial 1.30</CardTitle>
                </div>
                <CardDescription>
                  Standard Audit File for Tax — norsk format for myndighetskrav og revisjon.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!aktivKlient && (
                  <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-4 flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
                    <p className="text-sm">Velg en klient i sidepanelet for å generere SAF-T.</p>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { label: "Bokførte bilag", value: meta.antallBilag },
                    { label: "Posteringslinjer", value: meta.antallPosteringer },
                    { label: "Klient", value: aktivKlient?.navn ?? "—" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg border border-border/50 p-3">
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                      <p className="text-sm font-semibold mt-0.5">{s.value}</p>
                    </div>
                  ))}
                </div>

                {meta.periodeStart && (
                  <p className="text-xs text-muted-foreground">
                    Periode: {meta.periodeStart} → {meta.periodeSlutt}
                  </p>
                )}

                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Innhold i SAF-T-filen</h3>
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    {[
                      "Kontoplan med SAF-T-kontoklasser (NS 4102)",
                      "MVA-tabell med alle norske koder",
                      "Alle bokførte bilag og posteringslinjer",
                      "MVA-informasjon per posteringslinje",
                      "Selskaps- og periodeheader",
                    ].map((punkt) => (
                      <li key={punkt} className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        {punkt}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Validering (#119) */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={!kanEksportere || genererSaft}
                    onClick={() => {
                      if (!aktivKlient) return;
                      const xml = genererSaftXml({ bilag, klient: aktivKlient, motparter });
                      setSaftValidering(validerSaftXml(xml));
                    }}
                  >
                    <AlertCircle className="mr-2 h-4 w-4" />
                    Valider XML
                  </Button>
                  <Button
                    disabled={!kanEksportere || genererSaft}
                    onClick={async () => {
                      if (!aktivKlient) return;
                      setGenererSaft(true);
                      try {
                        lastNedSaftXml({ bilag, klient: aktivKlient, motparter });
                      } finally {
                        setGenererSaft(false);
                      }
                    }}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {genererSaft ? "Genererer…" : "Last ned SAF-T XML"}
                  </Button>
                </div>

                {/* Valideringsresultat */}
                {saftValidering && (
                  <div className={`rounded-lg border p-4 space-y-2 ${
                    saftValidering.gyldig
                      ? "border-green-500/30 bg-green-500/5"
                      : "border-red-500/30 bg-red-500/5"
                  }`}>
                    <p className={`text-sm font-semibold flex items-center gap-2 ${
                      saftValidering.gyldig ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"
                    }`}>
                      {saftValidering.gyldig ? "✓ SAF-T XML er strukturelt gyldig" : "✗ SAF-T XML har valideringsfeil"}
                    </p>
                    <div className="space-y-1">
                      {saftValidering.funn.map((funn, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <span className={`shrink-0 mt-0.5 ${
                            funn.alvorlighet === "feil"
                              ? "text-red-600"
                              : funn.alvorlighet === "advarsel"
                              ? "text-amber-600"
                              : "text-green-600"
                          }`}>
                            {funn.alvorlighet === "feil" ? "✗" : funn.alvorlighet === "advarsel" ? "⚠" : "✓"}
                          </span>
                          <span className="text-muted-foreground">{funn.beskrivelse}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Filnavn: SAF-T_Financial_{aktivKlient?.orgnr ?? "orgnr"}_{new Date().toISOString().slice(0,10).replace(/-/g,"")}_001.xml
                </p>
              </CardContent>
            </Card>
          </SlideIn>
        );
      })()}
    </div>
  );
}
