"use client";

/**
 * Budsjettering — årsbudsjett og budsjett vs. regnskap (#89)
 *
 * Lar brukeren sette opp et årsbudsjett per kontoklasse/-gruppe.
 * Viser deretter faktiske tall fra bokførte bilag mot budsjettet,
 * med avvik i NOK og prosent.
 */

import { useState, useMemo } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Trash2,
  Save,
  TrendingUp,
  TrendingDown,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { SlideIn, StaggerList, StaggerItem } from "@/components/motion";
import { useAuth } from "@/hooks/use-auth";
import { useAktivKlient } from "@/hooks/use-aktiv-klient";
import { useBilag } from "@/hooks/use-bilag";
import { useBudsjett } from "@/hooks/use-budsjett";
import { useKontoplan } from "@/hooks/use-kontoplan";
import { showToast } from "@/lib/toast";
import type { BudsjettLinje } from "@/types";

// ─── Hjelpere ───────────────────────────────────────────────────────────────

function formatNOK(v: number) {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);
}

function kontoKlasseLabel(klasse: string) {
  const map: Record<string, string> = {
    "1": "Eiendeler",
    "2": "Gjeld og egenkapital",
    "3": "Driftsinntekter",
    "4": "Varekostnad",
    "5": "Lønnskostnader",
    "6": "Andre driftskostnader",
    "7": "Andre driftskostnader (forts.)",
    "8": "Finansposter",
  };
  return map[klasse] ?? `Klasse ${klasse}`;
}

/** Beregn faktiske beløp per kontonr fra bokførte bilag */
function beregnFaktiske(bilag: ReturnType<typeof useBilag>["bilag"]) {
  const map = new Map<string, { navn: string; belop: number }>();
  for (const b of bilag) {
    if (b.status !== "bokført" && b.status !== "kreditert") continue;
    for (const p of b.posteringer) {
      const netto = p.debet - p.kredit;
      const eksist = map.get(p.kontonr);
      if (eksist) {
        eksist.belop += netto;
      } else {
        map.set(p.kontonr, { navn: p.kontonavn, belop: netto });
      }
    }
  }
  return map;
}

// ─── Skjema ─────────────────────────────────────────────────────────────────

const linjeSchema = z.object({
  kontonr: z.string().min(1, "Kontonr er påkrevd").max(8),
  kontonavn: z.string().min(1, "Navn er påkrevd"),
  årsbudsjett: z
    .string()
    .refine((v) => !isNaN(Number(v.replace(/\s/g, "").replace(",", "."))), "Ugyldig beløp"),
});

const skjemaSchema = z.object({
  linjer: z.array(linjeSchema),
});

type SkjemaVerdier = z.infer<typeof skjemaSchema>;

// ─── Avvik-badge ────────────────────────────────────────────────────────────

function AvvikBadge({ budsjett, faktisk }: { budsjett: number; faktisk: number }) {
  if (budsjett === 0) return <Badge variant="outline">—</Badge>;
  const avvik = faktisk - budsjett;
  const pst = Math.round((avvik / Math.abs(budsjett)) * 100);
  const over = avvik > 0;
  return (
    <Badge
      variant="outline"
      className={over ? "text-red-600 border-red-300" : "text-green-600 border-green-300"}
    >
      {over ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
      {over ? "+" : ""}{pst}%
    </Badge>
  );
}

// ─── Hoved-side ─────────────────────────────────────────────────────────────

export default function BudsjettPage() {
  const { user } = useAuth();
  const { aktivKlientId, aktivKlient } = useAktivKlient();
  const inneværendeÅr = new Date().getFullYear();
  const [valgtÅr, setValgtÅr] = useState(inneværendeÅr);
  const [redigerModus, setRedigerModus] = useState(false);
  const [åpneKlasser, setÅpneKlasser] = useState<Set<string>>(new Set(["3", "4", "5", "6"]));
  const [lagrer, setLagrer] = useState(false);

  const { bilag, loading: bilagLaster } = useBilag(user?.uid ?? null, aktivKlientId);
  const { budsjett, loading: budsjettLaster, lagre } = useBudsjett(
    user?.uid ?? null,
    aktivKlientId,
    valgtÅr
  );
  const { kontoplan: kontoer } = useKontoplan(user?.uid ?? null);

  const faktiske = useMemo(() => beregnFaktiske(bilag), [bilag]);

  // ── Skjema ──────────────────────────────────────────────────────────────
  const form = useForm<SkjemaVerdier>({
    resolver: zodResolver(skjemaSchema),
    defaultValues: { linjer: [] },
    values: {
      linjer: (budsjett?.linjer ?? []).map((l) => ({
        kontonr: l.kontonr,
        kontonavn: l.kontonavn,
        årsbudsjett: String(l.årsbudsjett),
      })),
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "linjer",
  });

  async function onSubmit(data: SkjemaVerdier) {
    setLagrer(true);
    try {
      const linjer: BudsjettLinje[] = data.linjer.map((l) => ({
        kontonr: l.kontonr,
        kontonavn: l.kontonavn,
        årsbudsjett: Number(l.årsbudsjett.replace(/\s/g, "").replace(",", ".")),
      }));
      await lagre(linjer);
      showToast.success("Budsjett lagret");
      setRedigerModus(false);
    } catch {
      showToast.error("Kunne ikke lagre budsjett");
    } finally {
      setLagrer(false);
    }
  }

  function leggTilLinje() {
    append({ kontonr: "", kontonavn: "", årsbudsjett: "0" });
  }

  function leggTilFraKontoplan(kontonr: string, kontonavn: string) {
    if (fields.some((f) => f.kontonr === kontonr)) return;
    append({ kontonr, kontonavn, årsbudsjett: "0" });
  }

  function toggleKlasse(klasse: string) {
    setÅpneKlasser((prev) => {
      const neste = new Set(prev);
      if (neste.has(klasse)) neste.delete(klasse);
      else neste.add(klasse);
      return neste;
    });
  }

  // ── Gruppert visning for sammenligning ──────────────────────────────────
  const linjerGruppert = useMemo(() => {
    const grupper = new Map<string, { linje: BudsjettLinje; faktisk: number }[]>();
    for (const linje of budsjett?.linjer ?? []) {
      const klasse = linje.kontonr[0] ?? "?";
      if (!grupper.has(klasse)) grupper.set(klasse, []);
      const faktiskData = faktiske.get(linje.kontonr);
      // For inntektskonti (kl. 3): faktisk er kredit-debet
      const faktiskBelop = faktiskData
        ? klasse === "3"
          ? -(faktiskData.belop)
          : faktiskData.belop
        : 0;
      grupper.get(klasse)!.push({ linje, faktisk: faktiskBelop });
    }
    return grupper;
  }, [budsjett, faktiske]);

  const totalBudsjett = useMemo(
    () => (budsjett?.linjer ?? []).reduce((s, l) => s + l.årsbudsjett, 0),
    [budsjett]
  );
  const totalFaktisk = useMemo(() => {
    let sum = 0;
    for (const linje of budsjett?.linjer ?? []) {
      const d = faktiske.get(linje.kontonr);
      if (d) sum += Math.abs(d.belop);
    }
    return sum;
  }, [budsjett, faktiske]);

  const isLoading = bilagLaster || budsjettLaster;

  return (
    <div className="space-y-6">
      {/* ── Topptekst ── */}
      <SlideIn>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              Budsjettering
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {aktivKlient ? aktivKlient.navn : "Alle klienter"} · Budsjett vs. regnskap
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* År-velger */}
            <div className="flex items-center gap-1 border rounded-md overflow-hidden">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => setValgtÅr((y) => y - 1)}
              >
                ‹
              </Button>
              <span className="text-sm font-medium px-2">{valgtÅr}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => setValgtÅr((y) => y + 1)}
              >
                ›
              </Button>
            </div>

            {redigerModus ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRedigerModus(false)}
                >
                  Avbryt
                </Button>
                <Button
                  size="sm"
                  onClick={form.handleSubmit(onSubmit)}
                  disabled={lagrer}
                >
                  {lagrer ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Lagre budsjett
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => setRedigerModus(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Rediger budsjett
              </Button>
            )}
          </div>
        </div>
      </SlideIn>

      {/* ── Sammendrag-kort ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))
        ) : (
          <>
            <Card>
              <CardHeader className="pb-1">
                <CardDescription>Årsbudsjett totalt</CardDescription>
                <CardTitle className="text-2xl">{formatNOK(totalBudsjett)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardDescription>Faktisk hittil i år</CardDescription>
                <CardTitle className="text-2xl">{formatNOK(totalFaktisk)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardDescription>Avvik</CardDescription>
                <CardTitle
                  className={`text-2xl ${
                    totalFaktisk > totalBudsjett ? "text-red-600" : "text-green-600"
                  }`}
                >
                  {formatNOK(totalFaktisk - totalBudsjett)}
                </CardTitle>
              </CardHeader>
            </Card>
          </>
        )}
      </div>

      {/* ── Rediger-modus ── */}
      {redigerModus && (
        <Card>
          <CardHeader>
            <CardTitle>Sett opp budsjett for {valgtÅr}</CardTitle>
            <CardDescription>
              Legg til kontoer og budsjetttall. Du kan hente kontoer fra kontoplanen din.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Form {...form}>
              <div className="space-y-3">
                {fields.map((field, idx) => (
                  <div key={field.id} className="flex items-start gap-2">
                    <FormField
                      control={form.control}
                      name={`linjer.${idx}.kontonr`}
                      render={({ field }) => (
                        <FormItem className="w-24 flex-shrink-0">
                          {idx === 0 && <FormLabel>Kontonr</FormLabel>}
                          <FormControl>
                            <Input {...field} placeholder="3000" className="text-sm" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`linjer.${idx}.kontonavn`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          {idx === 0 && <FormLabel>Kontonavn</FormLabel>}
                          <FormControl>
                            <Input {...field} placeholder="Salgsinntekter" className="text-sm" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`linjer.${idx}.årsbudsjett`}
                      render={({ field }) => (
                        <FormItem className="w-36 flex-shrink-0">
                          {idx === 0 && <FormLabel>Årsbudsjett (NOK)</FormLabel>}
                          <FormControl>
                            <Input {...field} placeholder="500000" className="text-sm text-right" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className={idx === 0 ? "mt-6" : ""}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-destructive hover:text-destructive"
                        onClick={() => remove(idx)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-2 flex-wrap">
                <Button type="button" variant="outline" size="sm" onClick={leggTilLinje}>
                  <Plus className="h-4 w-4 mr-1" />
                  Legg til linje
                </Button>

                {/* Hurtigknapper fra kontoplan */}
                {kontoer.slice(0, 8).map((k: { nummer: string; navn: string }) => (
                  <Button
                    key={k.nummer}
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => leggTilFraKontoplan(k.nummer, k.navn)}
                    disabled={fields.some((f) => f.kontonr === k.nummer)}
                  >
                    + {k.nummer} {k.navn}
                  </Button>
                ))}
              </div>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* ── Budsjett vs. regnskap ── */}
      {!redigerModus && (
        <SlideIn>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : linjerGruppert.size === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Ingen budsjettlinjer for {valgtÅr}</p>
                <p className="text-sm mt-1">
                  Klikk &quot;Rediger budsjett&quot; for å sette opp et årsbudsjett.
                </p>
              </CardContent>
            </Card>
          ) : (
            <StaggerList className="space-y-3">
              {[...linjerGruppert.entries()].sort(([a], [b]) => a.localeCompare(b)).map(
                ([klasse, linjer]) => {
                  const åpen = åpneKlasser.has(klasse);
                  const klasseBudsjett = linjer.reduce((s, l) => s + l.linje.årsbudsjett, 0);
                  const klasseFaktisk = linjer.reduce((s, l) => s + l.faktisk, 0);
                  return (
                    <StaggerItem key={klasse}>
                      <Card className="overflow-hidden">
                        <button
                          className="w-full text-left"
                          onClick={() => toggleKlasse(klasse)}
                        >
                          <CardHeader className="py-3 px-4 hover:bg-muted/50 transition-colors">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {åpen ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                                <span className="font-semibold text-sm">
                                  Klasse {klasse} — {kontoKlasseLabel(klasse)}
                                </span>
                                <Badge variant="secondary" className="text-xs">
                                  {linjer.length} kontoer
                                </Badge>
                              </div>
                              <div className="flex items-center gap-4 text-sm">
                                <span className="hidden sm:block text-muted-foreground">
                                  Budsjett: {formatNOK(klasseBudsjett)}
                                </span>
                                <span className="hidden sm:block">
                                  Faktisk: {formatNOK(klasseFaktisk)}
                                </span>
                                <AvvikBadge budsjett={klasseBudsjett} faktisk={klasseFaktisk} />
                              </div>
                            </div>
                          </CardHeader>
                        </button>

                        {åpen && (
                          <CardContent className="p-0">
                            <div className="divide-y">
                              {linjer.map(({ linje, faktisk }) => {
                                const avvik = faktisk - linje.årsbudsjett;
                                return (
                                  <div
                                    key={linje.kontonr}
                                    className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-4 py-2.5 text-sm hover:bg-muted/30"
                                  >
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="text-xs font-mono">
                                        {linje.kontonr}
                                      </Badge>
                                      <span className="truncate">{linje.kontonavn}</span>
                                    </div>
                                    <div className="text-right font-mono text-muted-foreground">
                                      {formatNOK(linje.årsbudsjett)}
                                    </div>
                                    <div className="text-right font-mono">
                                      {formatNOK(faktisk)}
                                    </div>
                                    <div className="flex items-center justify-end gap-2">
                                      <span
                                        className={`font-mono text-xs ${
                                          avvik > 0 ? "text-red-600" : "text-green-600"
                                        }`}
                                      >
                                        {avvik >= 0 ? "+" : ""}
                                        {formatNOK(avvik)}
                                      </span>
                                      <AvvikBadge budsjett={linje.årsbudsjett} faktisk={faktisk} />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            {/* Kolonne-header (kun synlig) */}
                            <div className="hidden sm:grid sm:grid-cols-4 gap-2 px-4 py-1.5 bg-muted/20 text-xs text-muted-foreground border-t">
                              <span>Konto</span>
                              <span className="text-right">Budsjett</span>
                              <span className="text-right">Faktisk</span>
                              <span className="text-right">Avvik</span>
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    </StaggerItem>
                  );
                }
              )}
            </StaggerList>
          )}
        </SlideIn>
      )}
    </div>
  );
}
