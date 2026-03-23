"use client";

/**
 * Avskrivninger og periodisering (#87)
 *
 * Anleggsmiddelregister med:
 * - Registrering av anleggsmidler (maskiner, inventar, biler osv.)
 * - Lineær og saldobasert avskrivning
 * - Avskrivningsplan per anleggsmiddel
 * - Samlet avskrivningsoversikt per år
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Building2,
  Loader2,
  TrendingDown,
  BarChart3,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  useAnleggsmidler,
  beregnAvskrivningsplan,
  type AnleggsmiddelMedId,
} from "@/hooks/use-anleggsmidler";
import { showToast } from "@/lib/toast";
import type { Avskrivningsmetode } from "@/types";

// ─── Hjelpere ───────────────────────────────────────────────────────────────

function formatNOK(v: number) {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);
}

// ─── Skjema ─────────────────────────────────────────────────────────────────

const skjemaSchema = z.object({
  navn: z.string().min(1, "Navn er påkrevd"),
  kontonr: z.string().min(1, "Kontonr er påkrevd").max(8),
  kostpris: z.string().refine((v) => !isNaN(Number(v)) && Number(v) > 0, "Ugyldig beløp"),
  anskaffetDato: z.string().min(1, "Dato er påkrevd"),
  levetidÅr: z.string().refine((v) => !isNaN(Number(v)) && Number(v) >= 1, "Minst 1 år"),
  metode: z.enum(["lineær", "saldo"]),
  restverdi: z.string().optional(),
  saldoSats: z.string().optional(),
});

type SkjemaVerdier = z.infer<typeof skjemaSchema>;

// ─── AnleggsmiddelKort ───────────────────────────────────────────────────────

function AnleggsmiddelKort({
  a,
  onSlett,
}: {
  a: AnleggsmiddelMedId;
  onSlett: () => void;
}) {
  const [åpen, setÅpen] = useState(false);
  const plan = beregnAvskrivningsplan(a);
  const inneværendeÅr = new Date().getFullYear();
  const åretAvskrivning = plan.find((l) => l.år === inneværendeÅr)?.avskrivning ?? 0;
  const bokførtVerdi = plan.find((l) => l.år === inneværendeÅr)?.bokførtVerdi ?? a.kostpris;

  return (
    <Card className="overflow-hidden">
      <button className="w-full text-left" onClick={() => setÅpen((p) => !p)}>
        <CardHeader className="py-3 px-4 hover:bg-muted/50 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {åpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="font-medium text-sm">{a.navn}</span>
              <Badge variant="outline" className="text-xs font-mono">{a.kontonr}</Badge>
              <Badge variant="secondary" className="text-xs capitalize">{a.metode}</Badge>
            </div>
            <div className="hidden sm:flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">
                Kostpris: <span className="font-mono">{formatNOK(a.kostpris)}</span>
              </span>
              <span className="text-muted-foreground">
                Bokført: <span className="font-mono text-foreground">{formatNOK(bokførtVerdi)}</span>
              </span>
              <span className="text-amber-600 font-mono text-xs">
                -{formatNOK(åretAvskrivning)}/år
              </span>
            </div>
          </div>
        </CardHeader>
      </button>

      {åpen && (
        <CardContent className="p-0 border-t">
          <div className="px-4 py-3 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Anskaffet</p>
                <p>{a.anskaffetDato}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Levetid</p>
                <p>{a.levetidÅr} år</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {a.metode === "saldo" ? "Saldosats" : "Restverdi"}
                </p>
                <p>
                  {a.metode === "saldo"
                    ? `${a.saldoSats ?? 20}%`
                    : formatNOK(a.restverdi ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Årsavskrivning ({inneværendeÅr})</p>
                <p className="text-amber-600 font-mono">{formatNOK(åretAvskrivning)}</p>
              </div>
            </div>

            {/* Avskrivningsplan-tabell */}
            <div className="rounded-lg border overflow-hidden">
              <div className="grid grid-cols-4 bg-muted px-3 py-1.5 text-xs text-muted-foreground font-medium">
                <span>År</span>
                <span className="text-right">Avskrivning</span>
                <span className="text-right">Akkumulert</span>
                <span className="text-right">Bokført verdi</span>
              </div>
              {plan.slice(0, 10).map((l) => (
                <div
                  key={l.år}
                  className={`grid grid-cols-4 px-3 py-1.5 text-xs font-mono ${
                    l.år === inneværendeÅr
                      ? "bg-primary/5 font-semibold"
                      : "odd:bg-muted/20"
                  }`}
                >
                  <span className={l.år === inneværendeÅr ? "text-primary" : ""}>
                    {l.år}
                    {l.år === inneværendeÅr && " ←"}
                  </span>
                  <span className="text-right text-amber-600">
                    -{formatNOK(l.avskrivning)}
                  </span>
                  <span className="text-right text-muted-foreground">
                    {formatNOK(l.akkumulertAvskrivning)}
                  </span>
                  <span className="text-right">{formatNOK(l.bokførtVerdi)}</span>
                </div>
              ))}
              {plan.length > 10 && (
                <div className="px-3 py-1.5 text-xs text-muted-foreground bg-muted/20 text-center">
                  + {plan.length - 10} år til
                </div>
              )}
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={onSlett}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Slett anleggsmiddel
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Hoved-side ─────────────────────────────────────────────────────────────

export default function AvskrivningerPage() {
  const { user } = useAuth();
  const { aktivKlientId, aktivKlient } = useAktivKlient();
  const inneværendeÅr = new Date().getFullYear();
  const [visSkjema, setVisSkjema] = useState(false);
  const [lagrer, setLagrer] = useState(false);

  const { anleggsmidler, loading, leggTil, slett } = useAnleggsmidler(
    user?.uid ?? null,
    aktivKlientId
  );

  // Totale avskrivninger i år
  const totalAvskrivningÅr = anleggsmidler.reduce((s, a) => {
    const plan = beregnAvskrivningsplan(a);
    return s + (plan.find((l) => l.år === inneværendeÅr)?.avskrivning ?? 0);
  }, 0);

  const totalKostpris = anleggsmidler.reduce((s, a) => s + a.kostpris, 0);
  const totalBokførtVerdi = anleggsmidler.reduce((s, a) => {
    const plan = beregnAvskrivningsplan(a);
    return s + (plan.find((l) => l.år === inneværendeÅr)?.bokførtVerdi ?? a.kostpris);
  }, 0);

  // ── Skjema ──────────────────────────────────────────────────────────────
  const form = useForm<SkjemaVerdier>({
    resolver: zodResolver(skjemaSchema),
    defaultValues: {
      navn: "",
      kontonr: "1200",
      kostpris: "",
      anskaffetDato: new Date().toISOString().slice(0, 10),
      levetidÅr: "5",
      metode: "lineær",
      restverdi: "0",
      saldoSats: "20",
    },
  });

  const valgtMetode = form.watch("metode") as Avskrivningsmetode;

  async function onSubmit(data: SkjemaVerdier) {
    setLagrer(true);
    try {
      await leggTil({
        navn: data.navn,
        kontonr: data.kontonr,
        kostpris: Number(data.kostpris),
        anskaffetDato: data.anskaffetDato,
        levetidÅr: Number(data.levetidÅr),
        metode: data.metode as Avskrivningsmetode,
        restverdi: data.restverdi ? Number(data.restverdi) : undefined,
        saldoSats: data.saldoSats ? Number(data.saldoSats) : undefined,
      });
      showToast.success("Anleggsmiddel registrert");
      form.reset();
      setVisSkjema(false);
    } catch {
      showToast.error("Kunne ikke registrere anleggsmiddel");
    }
    setLagrer(false);
  }

  return (
    <div className="space-y-6">
      {/* ── Topptekst ── */}
      <SlideIn>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <TrendingDown className="h-6 w-6 text-primary" />
              Avskrivninger
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {aktivKlient ? aktivKlient.navn : "Alle klienter"} · Anleggsmiddelregister
            </p>
          </div>
          <Button size="sm" onClick={() => setVisSkjema((p) => !p)}>
            <Plus className="h-4 w-4 mr-2" />
            Nytt anleggsmiddel
          </Button>
        </div>
      </SlideIn>

      {/* ── Sammendrag ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))
        ) : (
          <>
            <Card>
              <CardHeader className="pb-1">
                <CardDescription className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" /> Anleggsmidler
                </CardDescription>
                <CardTitle className="text-2xl">{anleggsmidler.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardDescription className="flex items-center gap-1">
                  <BarChart3 className="h-3.5 w-3.5" /> Total kostpris
                </CardDescription>
                <CardTitle className="text-2xl">{formatNOK(totalKostpris)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardDescription className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> Avskrivning {inneværendeÅr}
                </CardDescription>
                <CardTitle className="text-2xl text-amber-600">
                  -{formatNOK(totalAvskrivningÅr)}
                </CardTitle>
              </CardHeader>
            </Card>
          </>
        )}
      </div>

      {totalBokførtVerdi > 0 && totalKostpris > 0 && (
        <div className="text-sm text-muted-foreground">
          Samlet bokført verdi: <span className="font-mono text-foreground">{formatNOK(totalBokførtVerdi)}</span>
          {" "}(avskrevet{" "}
          <span className="font-mono text-amber-600">
            {Math.round(((totalKostpris - totalBokførtVerdi) / totalKostpris) * 100)}%
          </span>)
        </div>
      )}

      {/* ── Registreringsskjema ── */}
      {visSkjema && (
        <Card>
          <CardHeader>
            <CardTitle>Registrer anleggsmiddel</CardTitle>
            <CardDescription>
              Anleggsmidler avskrives etter norsk regnskapsstandard (NRS).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="navn"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Navn</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Firmabil Toyota Yaris" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="kontonr"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Balansekontonr</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="1200" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="kostpris"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Kostpris (NOK)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="250000" inputMode="numeric" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="anskaffetDato"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Anskaffelsesdato</FormLabel>
                        <FormControl>
                          <Input {...field} type="date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="levetidÅr"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Levetid (år)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="5" inputMode="numeric" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="metode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Avskrivningsmetode</FormLabel>
                        <FormControl>
                          <select
                            {...field}
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                          >
                            <option value="lineær">Lineær (jevn fordeling)</option>
                            <option value="saldo">Saldobasert (% av restverdi)</option>
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {valgtMetode === "lineær" ? (
                    <FormField
                      control={form.control}
                      name="restverdi"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Restverdi (NOK)</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="0" inputMode="numeric" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : (
                    <FormField
                      control={form.control}
                      name="saldoSats"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Saldosats (%)</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="20" inputMode="numeric" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={lagrer}>
                    {lagrer ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" />
                    )}
                    Registrer
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setVisSkjema(false)}
                  >
                    Avbryt
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* ── Anleggsmiddelliste ── */}
      <SlideIn>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : anleggsmidler.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <TrendingDown className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Ingen anleggsmidler registrert</p>
              <p className="text-sm mt-1">
                Klikk &quot;Nytt anleggsmiddel&quot; for å starte.
              </p>
            </CardContent>
          </Card>
        ) : (
          <StaggerList className="space-y-3">
            {anleggsmidler.map((a) => (
              <StaggerItem key={a.id}>
                <AnleggsmiddelKort
                  a={a}
                  onSlett={async () => {
                    await slett(a.id);
                    showToast.success("Anleggsmiddel slettet");
                  }}
                />
              </StaggerItem>
            ))}
          </StaggerList>
        )}
      </SlideIn>
    </div>
  );
}
