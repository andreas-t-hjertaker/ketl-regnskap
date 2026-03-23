"use client";

/**
 * Fakturamodul — utgående fakturaer
 *
 * Opprette, sende og følge opp fakturaer til kunder.
 * Fakturanr tildeles sekvensielt: FF-YYYY-NNNNN.
 * Iht. Bokfl. § 10 (nummerering) og Mval. § 15-10 (salgsdokumentasjon).
 */

import { useState, useMemo } from "react";
import {
  FileText,
  Plus,
  Send,
  CheckCircle2,
  Clock,
  AlertCircle,
  Trash2,
  ChevronDown,
  X,
  CreditCard,
  BookOpen,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SlideIn } from "@/components/motion";
import { useAuth } from "@/hooks/use-auth";
import { useAktivKlient } from "@/hooks/use-aktiv-klient";
import { useMotparter } from "@/hooks/use-motparter";
import { useFaktura, beregnFakturaSummer, type FakturaMedId } from "@/hooks/use-faktura";
import Link from "next/link";
import { formatDate, cn } from "@/lib/utils";
import type { FakturaLinje, FakturaStatus } from "@/types";

// ─── Hjelpefunksjoner ─────────────────────────────────────────────────────────

function fmtKr(beløp: number): string {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(beløp);
}

// ─── Status-hjelpere ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  FakturaStatus,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  kladd:     { label: "Kladd",     variant: "secondary" },
  sendt:     { label: "Sendt",     variant: "default" },
  betalt:    { label: "Betalt",    variant: "default" },
  forfalt:   { label: "Forfalt",   variant: "destructive" },
  kreditert: { label: "Kreditert", variant: "outline" },
};

function StatusBadge({ status }: { status: FakturaStatus }) {
  const cfg = STATUS_CONFIG[status];
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

// ─── Tom fakturalinje ─────────────────────────────────────────────────────────

function tomLinje(): FakturaLinje {
  return {
    beskrivelse: "",
    antall: 1,
    enhetspris: 0,
    mvaKode: "25",
    mvaSats: 25,
    rabatt: 0,
  };
}

const MVA_SATS: Record<string, number> = {
  "25": 25, "15": 15, "12": 12, "0": 0, fritak: 0,
};

// ─── Ny faktura-skjema ────────────────────────────────────────────────────────

type NyFakturaSkjema = {
  motpartId: string;
  kundeNavn: string;
  kundeOrgnr: string;
  dato: string;
  forfallsDato: string;
  kid: string;
  bankkontonr: string;
  linjer: FakturaLinje[];
};

function tomSkjema(): NyFakturaSkjema {
  const idag = new Date().toISOString().slice(0, 10);
  const forfall = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  return {
    motpartId: "",
    kundeNavn: "",
    kundeOrgnr: "",
    dato: idag,
    forfallsDato: forfall,
    kid: "",
    bankkontonr: "",
    linjer: [tomLinje()],
  };
}

// ─── NyFakturaPanel ───────────────────────────────────────────────────────────

function NyFakturaPanel({
  kunder,
  onLagre,
  onAvbryt,
}: {
  kunder: { id: string; navn: string; orgnr?: string }[];
  onLagre: (skjema: NyFakturaSkjema) => Promise<void>;
  onAvbryt: () => void;
}) {
  const [skjema, setSkjema] = useState<NyFakturaSkjema>(tomSkjema());
  const [lagrer, setLagrer] = useState(false);

  const summer = useMemo(() => beregnFakturaSummer(skjema.linjer), [skjema.linjer]);

  function settMotpart(motpartId: string) {
    const kunde = kunder.find((k) => k.id === motpartId);
    setSkjema((s) => ({
      ...s,
      motpartId,
      kundeNavn: kunde?.navn ?? "",
      kundeOrgnr: kunde?.orgnr ?? "",
    }));
  }

  function oppdaterLinje(idx: number, felt: keyof FakturaLinje, verdi: string | number) {
    setSkjema((s) => {
      const linjer = [...s.linjer];
      const linje = { ...linjer[idx] } as Record<string, unknown>;
      linje[felt] = verdi;
      if (felt === "mvaKode") {
        linje.mvaSats = MVA_SATS[verdi as string] ?? 25;
      }
      linjer[idx] = linje as FakturaLinje;
      return { ...s, linjer };
    });
  }

  function leggTilLinje() {
    setSkjema((s) => ({ ...s, linjer: [...s.linjer, tomLinje()] }));
  }

  function fjernLinje(idx: number) {
    setSkjema((s) => ({ ...s, linjer: s.linjer.filter((_, i) => i !== idx) }));
  }

  async function handleLagre() {
    if (!skjema.motpartId || !skjema.dato || skjema.linjer.length === 0) return;
    setLagrer(true);
    await onLagre(skjema);
    setLagrer(false);
  }

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Ny faktura</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Kunde */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Kunde *</Label>
            <select
              className="w-full h-8 rounded-md border border-border bg-background px-2 text-sm outline-none focus:ring-1 focus:ring-ring"
              value={skjema.motpartId}
              onChange={(e) => settMotpart(e.target.value)}
            >
              <option value="">Velg kunde…</option>
              {kunder.map((k) => (
                <option key={k.id} value={k.id}>{k.navn}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Org.nr. (kunden)</Label>
            <Input
              className="h-8 text-xs"
              value={skjema.kundeOrgnr}
              onChange={(e) => setSkjema((s) => ({ ...s, kundeOrgnr: e.target.value }))}
              placeholder="9 siffer"
            />
          </div>
        </div>

        {/* Datoer */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Fakturadato *</Label>
            <Input
              type="date"
              className="h-8 text-xs"
              value={skjema.dato}
              onChange={(e) => setSkjema((s) => ({ ...s, dato: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Forfallsdato *</Label>
            <Input
              type="date"
              className="h-8 text-xs"
              value={skjema.forfallsDato}
              onChange={(e) => setSkjema((s) => ({ ...s, forfallsDato: e.target.value }))}
            />
          </div>
        </div>

        {/* Linjer */}
        <div className="space-y-2">
          <Label className="text-xs">Fakturalinjer</Label>
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium">Beskrivelse</th>
                  <th className="px-2 py-1.5 text-right font-medium w-16">Ant.</th>
                  <th className="px-2 py-1.5 text-right font-medium w-24">Pris eks.</th>
                  <th className="px-2 py-1.5 text-center font-medium w-20">MVA</th>
                  <th className="px-2 py-1.5 text-right font-medium w-16">Rab.%</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {skjema.linjer.map((linje, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="px-1 py-1">
                      <Input
                        className="h-7 text-xs border-0 focus-visible:ring-0 px-1"
                        placeholder="Varetekst / tjeneste…"
                        value={linje.beskrivelse}
                        onChange={(e) => oppdaterLinje(idx, "beskrivelse", e.target.value)}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <Input
                        type="number"
                        className="h-7 text-xs border-0 focus-visible:ring-0 px-1 text-right"
                        value={linje.antall}
                        min={0}
                        onChange={(e) => oppdaterLinje(idx, "antall", parseFloat(e.target.value) || 0)}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <Input
                        type="number"
                        className="h-7 text-xs border-0 focus-visible:ring-0 px-1 text-right"
                        value={linje.enhetspris}
                        min={0}
                        onChange={(e) => oppdaterLinje(idx, "enhetspris", parseFloat(e.target.value) || 0)}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <select
                        className="w-full h-7 rounded border-0 bg-transparent text-xs outline-none"
                        value={linje.mvaKode}
                        onChange={(e) => oppdaterLinje(idx, "mvaKode", e.target.value)}
                      >
                        <option value="25">25 %</option>
                        <option value="15">15 %</option>
                        <option value="12">12 %</option>
                        <option value="0">0 %</option>
                        <option value="fritak">Fritak</option>
                      </select>
                    </td>
                    <td className="px-1 py-1">
                      <Input
                        type="number"
                        className="h-7 text-xs border-0 focus-visible:ring-0 px-1 text-right"
                        value={linje.rabatt ?? 0}
                        min={0}
                        max={100}
                        onChange={(e) => oppdaterLinje(idx, "rabatt", parseFloat(e.target.value) || 0)}
                      />
                    </td>
                    <td className="px-1 py-1 text-center">
                      {skjema.linjer.length > 1 && (
                        <button
                          onClick={() => fjernLinje(idx)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={leggTilLinje}>
            <Plus className="h-3 w-3 mr-1" />
            Legg til linje
          </Button>
        </div>

        {/* Summer */}
        <div className="ml-auto max-w-xs space-y-1 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Sum eks. MVA</span>
            <span>{fmtKr(summer.sumEksMva)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>MVA</span>
            <span>{fmtKr(summer.sumMva)}</span>
          </div>
          <div className="flex justify-between font-semibold border-t pt-1">
            <span>Sum ink. MVA</span>
            <span>{fmtKr(summer.sumInkMva)}</span>
          </div>
        </div>

        {/* Betalingsinformasjon */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Bankkontonr.</Label>
            <Input
              className="h-8 text-xs font-mono"
              placeholder="1234.56.78901"
              value={skjema.bankkontonr}
              onChange={(e) => setSkjema((s) => ({ ...s, bankkontonr: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">KID / betalingsreferanse</Label>
            <Input
              className="h-8 text-xs font-mono"
              placeholder="KID-nummer…"
              value={skjema.kid}
              onChange={(e) => setSkjema((s) => ({ ...s, kid: e.target.value }))}
            />
          </div>
        </div>

        {/* Knapper */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={onAvbryt}>
            Avbryt
          </Button>
          <Button
            size="sm"
            onClick={handleLagre}
            disabled={lagrer || !skjema.motpartId || !skjema.dato}
          >
            {lagrer ? "Lagrer…" : "Lagre kladd"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── FakturaKort ──────────────────────────────────────────────────────────────

function FakturaKort({
  faktura,
  onMarkerSendt,
  onMarkerBetalt,
  onKrediter,
  onSlett,
  onBokfor,
}: {
  faktura: FakturaMedId;
  onMarkerSendt: () => void;
  onMarkerBetalt: (dato: string) => void;
  onKrediter: () => void;
  onSlett: () => void;
  onBokfor: () => void;
}) {
  const [betaltDatoInput, setBetaltDatoInput] = useState(false);
  const [betaltDato, setBetaltDato] = useState(new Date().toISOString().slice(0, 10));

  const erAktiv = faktura.status === "sendt" || faktura.status === "forfalt";
  const erKladd = faktura.status === "kladd";

  return (
    <Card className={cn("transition-all", faktura.status === "forfalt" && "border-destructive/40")}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-semibold text-foreground">
                {faktura.fakturanrFormatert}
              </span>
              <StatusBadge status={faktura.status} />
            </div>
            <p className="mt-0.5 truncate text-sm font-medium">{faktura.kundeNavn}</p>
            {faktura.kundeOrgnr && (
              <p className="text-xs font-mono text-muted-foreground">{faktura.kundeOrgnr}</p>
            )}
            <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
              <span>Fakturert {formatDate(faktura.dato)}</span>
              <span>·</span>
              <span
                className={cn(
                  "flex items-center gap-0.5",
                  faktura.status === "forfalt" && "text-destructive font-medium"
                )}
              >
                <Clock className="h-3 w-3" />
                Forfall {formatDate(faktura.forfallsDato)}
              </span>
            </div>
          </div>

          <div className="text-right shrink-0">
            <p className="text-base font-bold">{fmtKr(faktura.sumInkMva)}</p>
            <p className="text-xs text-muted-foreground">
              + {fmtKr(faktura.sumMva)} MVA
            </p>
          </div>
        </div>

        {/* Linjeoversikt */}
        {faktura.linjer.length > 0 && (
          <div className="mt-3 rounded-md bg-muted/30 px-3 py-2 text-xs space-y-0.5">
            {faktura.linjer.slice(0, 3).map((l, i) => (
              <div key={i} className="flex justify-between text-muted-foreground">
                <span className="truncate mr-2">
                  {l.antall} × {l.beskrivelse || "—"}
                </span>
                <span className="shrink-0">
                  {fmtKr(l.antall * l.enhetspris * (1 - (l.rabatt ?? 0) / 100))}
                </span>
              </div>
            ))}
            {faktura.linjer.length > 3 && (
              <p className="text-muted-foreground">+{faktura.linjer.length - 3} linjer til</p>
            )}
          </div>
        )}

        {/* Betalingsdato-input */}
        {betaltDatoInput && (
          <div className="mt-3 flex items-center gap-2">
            <Input
              type="date"
              className="h-7 text-xs w-36"
              value={betaltDato}
              onChange={(e) => setBetaltDato(e.target.value)}
            />
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                onMarkerBetalt(betaltDato);
                setBetaltDatoInput(false);
              }}
            >
              Bekreft betalt
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setBetaltDatoInput(false)}
            >
              Avbryt
            </Button>
          </div>
        )}

        {/* Bilag-lenke hvis bokført */}
        {faktura.bilagId && (
          <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
            <BookOpen className="h-3 w-3" />
            <Link href="/dashboard/bilag" className="hover:underline text-primary">
              Se bokført bilag
            </Link>
          </div>
        )}

        {/* Handlingsknapper */}
        <div className="mt-3 flex items-center gap-2">
          {erKladd && (
            <>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onMarkerSendt}>
                <Send className="h-3 w-3 mr-1" />
                Merk som sendt
              </Button>
              {!faktura.bilagId && (
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onBokfor}>
                  <BookOpen className="h-3 w-3 mr-1" />
                  Bokfør
                </Button>
              )}
            </>
          )}
          {erAktiv && !betaltDatoInput && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => setBetaltDatoInput(true)}
            >
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Registrer betaling
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground">
              Mer <ChevronDown className="h-3 w-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {faktura.status !== "kreditert" && faktura.status !== "kladd" && (
                <>
                  <DropdownMenuItem onClick={onKrediter}>
                    <X className="h-3.5 w-3.5 mr-2" />
                    Krediter faktura
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {erKladd && (
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={onSlett}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                  Slett kladd
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Hovedside ────────────────────────────────────────────────────────────────

export default function FakturaPage() {
  const { user } = useAuth();
  const { aktivKlient } = useAktivKlient();
  const { motparter } = useMotparter(user?.uid ?? null, aktivKlient?.id);
  const {
    fakturaer,
    loading,
    kladder,
    sendte,
    forfalte,
    utestående,
    inntektMtd,
    opprettFaktura,
    markerSendt,
    markerBetalt,
    krediterFaktura,
    slettFaktura,
    bokforFaktura,
  } = useFaktura(user?.uid ?? null, aktivKlient?.id);

  const [visNy, setVisNy] = useState(false);
  const [statusFilter, setStatusFilter] = useState<FakturaStatus | "alle">("alle");

  const kunder = useMemo(
    () => motparter.filter((m) => m.type === "kunde"),
    [motparter]
  );

  const filtrerte = useMemo(
    () =>
      statusFilter === "alle"
        ? fakturaer
        : fakturaer.filter((f) => f.status === statusFilter),
    [fakturaer, statusFilter]
  );

  if (!aktivKlient) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
        <FileText className="h-10 w-10 opacity-30" />
        <p className="text-sm">Velg en klient i sidemenyen for å se fakturaer.</p>
      </div>
    );
  }

  return (
    <SlideIn>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Fakturaer</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Utgående fakturaer for {aktivKlient.navn}
            </p>
          </div>
          <Button onClick={() => setVisNy(true)} disabled={visNy}>
            <Plus className="h-4 w-4 mr-2" />
            Ny faktura
          </Button>
        </div>

        {/* KPI-kort */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardDescription className="text-xs">Kladder</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-bold">{kladder.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardDescription className="text-xs">Utestående</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-bold">{fmtKr(utestående)}</p>
              <p className="text-xs text-muted-foreground">
                {sendte.length + forfalte.length} fakturaer
              </p>
            </CardContent>
          </Card>
          <Card className={forfalte.length > 0 ? "border-destructive/40" : ""}>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardDescription className="text-xs flex items-center gap-1">
                {forfalte.length > 0 && <AlertCircle className="h-3 w-3 text-destructive" />}
                Forfalte
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className={cn("text-2xl font-bold", forfalte.length > 0 && "text-destructive")}>
                {forfalte.length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardDescription className="text-xs flex items-center gap-1">
                <CreditCard className="h-3 w-3" />
                Betalt
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-bold">{fmtKr(inntektMtd)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Ny faktura-panel */}
        {visNy && (
          <NyFakturaPanel
            kunder={kunder.map((k) => ({ id: k.id, navn: k.navn, orgnr: k.orgnr }))}
            onAvbryt={() => setVisNy(false)}
            onLagre={async (skjema) => {
              if (!user?.uid) return;
              await opprettFaktura({
                klientId: aktivKlient.id,
                motpartId: skjema.motpartId,
                kundeNavn: skjema.kundeNavn,
                kundeOrgnr: skjema.kundeOrgnr || undefined,
                dato: skjema.dato,
                forfallsDato: skjema.forfallsDato,
                linjer: skjema.linjer,
                kid: skjema.kid || undefined,
                bankkontonr: skjema.bankkontonr || undefined,
              });
              setVisNy(false);
            }}
          />
        )}

        {/* Filter */}
        <div className="flex items-center gap-2 flex-wrap">
          {(["alle", "kladd", "sendt", "betalt", "forfalt", "kreditert"] as const).map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setStatusFilter(s)}
            >
              {s === "alle" ? "Alle" : STATUS_CONFIG[s as FakturaStatus]?.label ?? s}
              {s !== "alle" && (
                <span className="ml-1.5 rounded-full bg-background/20 px-1.5 text-xs">
                  {fakturaer.filter((f) => f.status === s).length}
                </span>
              )}
            </Button>
          ))}
        </div>

        {/* Faktura-liste */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="h-16 bg-muted animate-pulse rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filtrerte.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
            <FileText className="h-10 w-10 opacity-30" />
            <p className="text-sm">
              {fakturaer.length === 0
                ? "Ingen fakturaer ennå. Klikk «Ny faktura» for å komme i gang."
                : "Ingen fakturaer med valgt filter."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtrerte.map((faktura) => (
              <FakturaKort
                key={faktura.id}
                faktura={faktura}
                onMarkerSendt={() => markerSendt(faktura.id, faktura)}
                onMarkerBetalt={(dato) => markerBetalt(faktura.id, faktura, dato)}
                onKrediter={() => krediterFaktura(faktura.id, faktura)}
                onSlett={() => slettFaktura(faktura.id, faktura.fakturanrFormatert)}
                onBokfor={() => bokforFaktura(faktura.id, faktura)}
              />
            ))}
          </div>
        )}
      </div>
    </SlideIn>
  );
}
