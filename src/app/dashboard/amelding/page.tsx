"use client";

/**
 * A-melding (#107) — Skatteetatens nytt JSON API
 *
 * Obligatorisk fra 1. april 2026. Erstatter gammelt XML-basert API.
 * Autentisering via Maskinporten → Altinn Systembruker.
 */

import { useState, useMemo } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Users,
  Plus,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Loader2,
  FileText,
  Building2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import { useAktivKlient } from "@/hooks/use-aktiv-klient";
import { useAnsatte, useLonnsUtbetalinger, useAmeldinInnsendinger } from "@/hooks/use-amelding";
import type { Ansatt, LonnsUtbetaling } from "@/types";

// ─── Skjema for ny ansatt ─────────────────────────────────────────────────────

const nyAnsattSchema = z.object({
  fnr: z.string().regex(/^\d{11}$/, "FNR/D-nummer må være 11 siffer"),
  navn: z.string().min(1, "Navn er påkrevd"),
  epost: z.string().email("Ugyldig e-post").optional().or(z.literal("")),
  arbeidsforholdId: z.string().min(1, "Arbeidsforhold-ID er påkrevd"),
  typeArbeidsforhold: z.enum([
    "ordinaertArbeidsforhold",
    "maritimtArbeidsforhold",
    "frilanserOppdragstakerHonorarPersonerMm",
  ]),
  ansettelsesdato: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Dato må være YYYY-MM-DD"),
  stillingsprosent: z.number({ error: "Påkrevd" }).min(1).max(100),
  antallTimerPerUke: z.number({ error: "Påkrevd" }).min(1).max(168),
  avloenningstype: z.enum(["fastLoenn", "timeloenn", "provisjon", "honorar"]),
  yrke: z.string().regex(/^\d{6}$/, "STYRK-08 kode — 6 siffer (f.eks. 241101)"),
  skattekommune: z.string().regex(/^\d{4}$/, "4-sifret kommunenummer (f.eks. 0301 for Oslo)"),
});
type NyAnsattData = z.infer<typeof nyAnsattSchema>;

// ─── Skjema for lønnsutbetaling ───────────────────────────────────────────────

const nyLonnsSchema = z.object({
  ansattId: z.string().min(1, "Velg ansatt"),
  bruttoLonn: z.number({ error: "Påkrevd" }).min(1, "Brutto lønn må være positiv"),
  inntektsBeskrivelse: z.enum([
    "fastloenn", "timeloenn", "overtidsgodtjoerelse", "bonus", "feriepenger", "sykepenger",
  ]),
  opptjeningFra: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  opptjeningTil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  skattetrekk: z.number({ error: "Påkrevd" }).min(0),
  utbetaltDato: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
type NyLonnsData = z.infer<typeof nyLonnsSchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const statusFarger: Record<string, string> = {
  kladd: "bg-muted text-muted-foreground",
  sendt: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  akseptert: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  avvist: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  feil: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  bekreftet: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
};

const typeArbeidsforholdLabels: Record<string, string> = {
  ordinaertArbeidsforhold: "Ordinært",
  maritimtArbeidsforhold: "Maritimt",
  frilanserOppdragstakerHonorarPersonerMm: "Frilans/Honorar",
};

function sisteNMåneder(n = 24): string[] {
  const måneder: string[] = [];
  const nå = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(nå.getFullYear(), nå.getMonth() - i, 1);
    måneder.push(d.toISOString().slice(0, 7));
  }
  return måneder;
}

function sisteDagIMåned(maaned: string): string {
  const [år, mnd] = maaned.split("-").map(Number);
  return new Date(år, mnd, 0).getDate().toString().padStart(2, "0");
}

// ─── Komponent: Ny ansatt (Sheet) ─────────────────────────────────────────────

function NyAnsattSheet({
  klientId,
  onOpprett,
}: {
  klientId: string;
  onOpprett: (data: Omit<Ansatt, "opprettet" | "aktiv">) => Promise<void>;
}) {
  const [åpen, setÅpen] = useState(false);
  const [lagrer, setLagrer] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NyAnsattData>({
    resolver: zodResolver(nyAnsattSchema),
    defaultValues: {
      typeArbeidsforhold: "ordinaertArbeidsforhold",
      avloenningstype: "fastLoenn",
      stillingsprosent: 100,
      antallTimerPerUke: 37.5,
    },
  });

  const onSubmit = handleSubmit(async (raw) => {
    const data = raw as unknown as NyAnsattData;
    setLagrer(true);
    try {
      await onOpprett({ ...data, klientId });
      setÅpen(false);
      reset();
    } finally {
      setLagrer(false);
    }
  });

  return (
    <Sheet open={åpen} onOpenChange={setÅpen}>
      <SheetTrigger render={<Button size="sm"><Plus className="h-4 w-4 mr-1" />Ny ansatt</Button>} />
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-6">
        <SheetHeader className="p-0 mb-4">
          <SheetTitle>Registrer ansatt</SheetTitle>
        </SheetHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-sm font-medium block mb-1">FNR / D-nummer</label>
              <Input placeholder="11 siffer" {...register("fnr")} />
              {errors.fnr && <p className="text-xs text-destructive mt-1">{errors.fnr.message}</p>}
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium block mb-1">Fullt navn</label>
              <Input placeholder="Ola Nordmann" {...register("navn")} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Arbeidsforhold-ID</label>
              <Input placeholder="AF-001" {...register("arbeidsforholdId")} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">STYRK-08 yrke</label>
              <Input placeholder="241101" {...register("yrke")} />
              {errors.yrke && <p className="text-xs text-destructive mt-1">{errors.yrke.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Ansettelsesdato</label>
              <Input type="date" {...register("ansettelsesdato")} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Skattekommune</label>
              <Input placeholder="0301" {...register("skattekommune")} />
              {errors.skattekommune && (
                <p className="text-xs text-destructive mt-1">{errors.skattekommune.message}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Stillingsprosent</label>
              <Input type="number" min={1} max={100} {...register("stillingsprosent", { valueAsNumber: true })} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Timer per uke</label>
              <Input type="number" step="0.5" {...register("antallTimerPerUke", { valueAsNumber: true })} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Type arbeidsforhold</label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                {...register("typeArbeidsforhold")}
              >
                <option value="ordinaertArbeidsforhold">Ordinært</option>
                <option value="maritimtArbeidsforhold">Maritimt</option>
                <option value="frilanserOppdragstakerHonorarPersonerMm">Frilans/Honorar</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Avlønningstype</label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                {...register("avloenningstype")}
              >
                <option value="fastLoenn">Fast lønn</option>
                <option value="timeloenn">Timelønn</option>
                <option value="provisjon">Provisjon</option>
                <option value="honorar">Honorar</option>
              </select>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={lagrer}>
            {lagrer ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Lagrer…</> : "Registrer ansatt"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── Komponent: Ny lønnsutbetaling (Sheet) ────────────────────────────────────

function NyLonnsSheet({
  klientId,
  kalendermaaned,
  ansatte,
  onRegistrer,
}: {
  klientId: string;
  kalendermaaned: string;
  ansatte: { id: string; navn: string }[];
  onRegistrer: (data: Omit<LonnsUtbetaling, "opprettet" | "status" | "arbeidsgiveravgift">) => Promise<void>;
}) {
  const [åpen, setÅpen] = useState(false);
  const [lagrer, setLagrer] = useState(false);

  const sisteDag = sisteDagIMåned(kalendermaaned);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<NyLonnsData>({
    resolver: zodResolver(nyLonnsSchema),
    defaultValues: {
      inntektsBeskrivelse: "fastloenn",
      skattetrekk: 0,
      opptjeningFra: `${kalendermaaned}-01`,
      opptjeningTil: `${kalendermaaned}-${sisteDag}`,
      utbetaltDato: `${kalendermaaned}-${sisteDag}`,
    },
  });

  const bruttoLonn = watch("bruttoLonn");
  const agaBeregnet = bruttoLonn ? Math.round(Number(bruttoLonn) * 0.141 * 100) / 100 : 0;
  const ansattId = watch("ansattId");

  const onSubmit = handleSubmit(async (raw) => {
    const data = raw as unknown as NyLonnsData;
    const ansattObj = ansatte.find((a) => a.id === data.ansattId);
    if (!ansattObj) return;
    setLagrer(true);
    try {
      await onRegistrer({
        ansattId: data.ansattId,
        arbeidsforholdId: data.ansattId,
        klientId,
        kalendermaaned,
        bruttoLonn: Number(data.bruttoLonn),
        inntektsBeskrivelse: data.inntektsBeskrivelse,
        opptjeningFra: data.opptjeningFra,
        opptjeningTil: data.opptjeningTil,
        skattetrekk: Number(data.skattetrekk),
        utbetaltDato: data.utbetaltDato,
      });
      setÅpen(false);
      reset();
    } finally {
      setLagrer(false);
    }
  });

  return (
    <Sheet open={åpen} onOpenChange={setÅpen}>
      <SheetTrigger render={<Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" />Registrer lønn</Button>} />
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto p-6">
        <SheetHeader className="p-0 mb-4">
          <SheetTitle>Lønnsutbetaling — {kalendermaaned}</SheetTitle>
        </SheetHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">Ansatt</label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              {...register("ansattId")}
            >
              <option value="">Velg ansatt</option>
              {ansatte.map((a) => (
                <option key={a.id} value={a.id}>{a.navn}</option>
              ))}
            </select>
            {errors.ansattId && (
              <p className="text-xs text-destructive mt-1">{errors.ansattId.message}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1">Brutto lønn (NOK)</label>
              <Input type="number" min={0} step="100" placeholder="50000" {...register("bruttoLonn", { valueAsNumber: true })} />
              {errors.bruttoLonn && (
                <p className="text-xs text-destructive mt-1">{errors.bruttoLonn.message}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Skattetrekk (NOK)</label>
              <Input type="number" min={0} step="100" placeholder="15000" {...register("skattetrekk", { valueAsNumber: true })} />
            </div>
          </div>
          {agaBeregnet > 0 && (
            <p className="text-xs text-muted-foreground">
              Arbeidsgiveravgift (14,1%): <strong>{agaBeregnet.toLocaleString("nb-NO")} NOK</strong>
            </p>
          )}
          <div>
            <label className="text-sm font-medium block mb-1">Inntektstype</label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              {...register("inntektsBeskrivelse")}
            >
              <option value="fastloenn">Fast lønn</option>
              <option value="timeloenn">Timelønn</option>
              <option value="overtidsgodtjoerelse">Overtidsgodtgjørelse</option>
              <option value="bonus">Bonus</option>
              <option value="feriepenger">Feriepenger</option>
              <option value="sykepenger">Sykepenger</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1">Opptjening fra</label>
              <Input type="date" {...register("opptjeningFra")} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Opptjening til</label>
              <Input type="date" {...register("opptjeningTil")} />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium block mb-1">Utbetalt dato</label>
              <Input type="date" {...register("utbetaltDato")} />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={lagrer || !ansattId}>
            {lagrer ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Lagrer…</> : "Registrer utbetaling"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── Hoved-side ───────────────────────────────────────────────────────────────

export default function AmeldingPage() {
  const { user } = useAuth();
  const { aktivKlient } = useAktivKlient();
  const [valgtMåned, setValgtMåned] = useState(new Date().toISOString().slice(0, 7));
  const [åpnetAnsatt, setÅpnetAnsatt] = useState<string | null>(null);
  const [senderLokal, setSenderLokal] = useState(false);

  const måneder = useMemo(() => sisteNMåneder(24), []);

  const { ansatte, loading: loadingAnsatte, opprettAnsatt } = useAnsatte(
    user?.uid ?? null,
    aktivKlient?.id
  );
  const { utbetalinger, loading: loadingLonn, registrerUtbetaling } = useLonnsUtbetalinger(
    user?.uid ?? null,
    aktivKlient?.id,
    valgtMåned
  );
  const { innsendinger, loading: loadingInn, sender: senderHook, sendAmelding } = useAmeldinInnsendinger(
    user?.uid ?? null,
    aktivKlient?.id
  );

  const tidligereInnsending = innsendinger.find(
    (i) => i.kalendermaaned === valgtMåned && i.status !== "kladd"
  );

  const sumBruttoLonn = utbetalinger.reduce((s, u) => s + u.bruttoLonn, 0);
  const sumSkattetrekk = utbetalinger.reduce((s, u) => s + u.skattetrekk, 0);
  const sumAga = utbetalinger.reduce((s, u) => s + (u.arbeidsgiveravgift ?? 0), 0);

  if (!aktivKlient) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Velg en klient for å se A-melding.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">A-melding</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Skatteetatens nytt JSON API — obligatorisk fra 1. april 2026
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/dashboard/amelding/lonnsslipp">
            <Button variant="outline" size="sm">
              <FileText className="h-4 w-4 mr-1.5" />
              Lønnsseddel
            </Button>
          </Link>
          <select
            value={valgtMåned}
            onChange={(e) => setValgtMåned(e.target.value)}
            className="rounded-md border bg-background px-3 py-2 text-sm w-44"
          >
          {måneder.map((m) => (
            <option key={m} value={m}>
              {new Date(m + "-01").toLocaleDateString("nb-NO", {
                month: "long",
                year: "numeric",
              })}
            </option>
          ))}
          </select>
        </div>
      </div>

      {/* Tidskritisk-banner */}
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 flex items-start gap-3 dark:border-amber-700 dark:bg-amber-950">
        <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium text-amber-800 dark:text-amber-300 text-sm">
            Obligatorisk fra 1. april 2026
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
            Skatteetaten krever nytt JSON-format. Konfigurer Maskinporten-nøkler under{" "}
            <strong>Innstillinger → Integrasjoner</strong> for å aktivere innsending.
          </p>
        </div>
      </div>

      {/* Oversikt-kort */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {loadingLonn ? <Skeleton className="h-8 w-24" /> : sumBruttoLonn.toLocaleString("nb-NO")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Brutto lønn — {valgtMåned}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {loadingLonn ? <Skeleton className="h-8 w-24" /> : sumSkattetrekk.toLocaleString("nb-NO")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Skattetrekk — {valgtMåned}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {loadingLonn ? <Skeleton className="h-8 w-24" /> : Math.round(sumAga).toLocaleString("nb-NO")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Arbeidsgiveravgift (14,1%) — {valgtMåned}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Ansatte */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Ansatte
              </CardTitle>
              <CardDescription>
                {loadingAnsatte ? "Laster…" : `${ansatte.filter((a) => a.aktiv).length} aktive`}
              </CardDescription>
            </div>
            <NyAnsattSheet klientId={aktivKlient.id} onOpprett={opprettAnsatt} />
          </CardHeader>
          <CardContent className="space-y-2">
            {loadingAnsatte ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
            ) : ansatte.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Ingen ansatte registrert.
              </p>
            ) : (
              ansatte.map((a) => (
                <div
                  key={a.id}
                  className="rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setÅpnetAnsatt(åpnetAnsatt === a.id ? null : a.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {åpnetAnsatt === a.id
                        ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      <span className="font-medium text-sm">{a.navn}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {typeArbeidsforholdLabels[a.typeArbeidsforhold] ?? a.typeArbeidsforhold}
                      </Badge>
                      <Badge className={`text-xs ${a.aktiv ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200" : "bg-muted text-muted-foreground"}`}>
                        {a.aktiv ? "Aktiv" : "Avsluttet"}
                      </Badge>
                    </div>
                  </div>
                  {åpnetAnsatt === a.id && (
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground border-t pt-3">
                      <div><span className="font-medium">FNR:</span> {a.fnr.slice(0, 6)}*****</div>
                      <div><span className="font-medium">Stilling:</span> {a.stillingsprosent}%</div>
                      <div><span className="font-medium">AF-ID:</span> {a.arbeidsforholdId}</div>
                      <div><span className="font-medium">Yrke:</span> {a.yrke}</div>
                      <div><span className="font-medium">Skattekommune:</span> {a.skattekommune}</div>
                      <div><span className="font-medium">Ansatt fra:</span> {a.ansettelsesdato}</div>
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Lønnsutbetalinger for valgt måned */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Lønnsutbetalinger
              </CardTitle>
              <CardDescription>
                {new Date(valgtMåned + "-01").toLocaleDateString("nb-NO", {
                  month: "long",
                  year: "numeric",
                })}
              </CardDescription>
            </div>
            <NyLonnsSheet
              klientId={aktivKlient.id}
              kalendermaaned={valgtMåned}
              ansatte={ansatte.filter((a) => a.aktiv)}
              onRegistrer={registrerUtbetaling}
            />
          </CardHeader>
          <CardContent className="space-y-2">
            {loadingLonn ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
            ) : utbetalinger.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Ingen lønnsutbetalinger registrert for {valgtMåned}.
              </p>
            ) : (
              <>
                {utbetalinger.map((u) => (
                  <div key={u.id} className="flex items-center justify-between rounded-lg border p-3 text-sm gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {ansatte.find((a) => a.id === u.ansattId)?.navn ?? u.ansattId}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">{u.inntektsBeskrivelse}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-medium">{u.bruttoLonn.toLocaleString("nb-NO")} NOK</p>
                      <p className="text-xs text-muted-foreground">
                        Trekk: {u.skattetrekk.toLocaleString("nb-NO")}
                      </p>
                    </div>
                    <Badge className={`text-xs ${statusFarger[u.status] ?? ""}`}>{u.status}</Badge>
                  </div>
                ))}
                <Separator className="my-2" />
                <div className="flex justify-between text-sm font-semibold px-1">
                  <span>Totalt brutto:</span>
                  <span>{sumBruttoLonn.toLocaleString("nb-NO")} NOK</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Send A-melding */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Send className="h-4 w-4" />
            Send A-melding
          </CardTitle>
          <CardDescription>
            Send inn A-melding for{" "}
            {new Date(valgtMåned + "-01").toLocaleDateString("nb-NO", {
              month: "long",
              year: "numeric",
            })}{" "}
            til Skatteetaten via nytt JSON API.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {tidligereInnsending && (
            <div
              className={`rounded-lg border p-3 flex items-center gap-2 text-sm ${
                tidligereInnsending.status === "akseptert" || tidligereInnsending.status === "bekreftet"
                  ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950"
                  : "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950"
              }`}
            >
              {tidligereInnsending.status === "akseptert" || tidligereInnsending.status === "bekreftet"
                ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                : <Clock className="h-4 w-4 text-amber-600 shrink-0" />}
              <span>
                A-melding sendt for denne måneden.
                {tidligereInnsending.referansenummer && (
                  <> Referanse: <strong>{tidligereInnsending.referansenummer}</strong></>
                )}{" "}
                — Status: <strong>{tidligereInnsending.status}</strong>
              </span>
            </div>
          )}

          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Ansatte inkludert: <strong>{ansatte.filter((a) => a.aktiv).length}</strong></p>
              <p>Lønnsutbetalinger: <strong>{utbetalinger.length}</strong></p>
              <p>Sum brutto lønn: <strong>{sumBruttoLonn.toLocaleString("nb-NO")} NOK</strong></p>
            </div>
            <Button
              disabled={senderHook || senderLokal || utbetalinger.length === 0 || !aktivKlient.orgnr}
              onClick={async () => {
                if (!aktivKlient?.orgnr) return;
                setSenderLokal(true);
                try {
                  await sendAmelding(aktivKlient.id, valgtMåned, aktivKlient.orgnr);
                } finally {
                  setSenderLokal(false);
                }
              }}
            >
              {senderHook || senderLokal ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Sender…</>
              ) : (
                <><Send className="h-4 w-4 mr-2" />Send A-melding</>
              )}
            </Button>
          </div>

          {!aktivKlient.orgnr && (
            <p className="text-xs text-destructive">
              Organisasjonsnummer mangler på klienten. Legg til orgnr under Klienter.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Innsendingshistorikk */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Innsendingshistorikk
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingInn ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full mb-2" />)
          ) : innsendinger.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Ingen A-meldinger sendt ennå.
            </p>
          ) : (
            <div className="space-y-2">
              {innsendinger.slice(0, 20).map((inn) => {
                const erOk = inn.status === "akseptert" || inn.status === "bekreftet";
                const erFeil = inn.status === "avvist" || inn.status === "feil";
                return (
                  <div
                    key={inn.id}
                    className="flex items-center justify-between rounded-lg border p-3 text-sm gap-2"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {erOk ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      ) : erFeil ? (
                        <XCircle className="h-4 w-4 text-destructive shrink-0" />
                      ) : (
                        <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium">
                          {new Date(inn.kalendermaaned + "-01").toLocaleDateString("nb-NO", {
                            month: "long",
                            year: "numeric",
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {inn.antallArbeidsforhold} arbeidsforhold ·{" "}
                          {inn.sumBruttoLonn.toLocaleString("nb-NO")} NOK
                          {inn.referansenummer && ` · Ref: ${inn.referansenummer}`}
                        </p>
                      </div>
                    </div>
                    <Badge className={`text-xs shrink-0 ${statusFarger[inn.status] ?? ""}`}>
                      {inn.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
