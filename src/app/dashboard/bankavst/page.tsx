"use client";

/**
 * Bankkontoavstemming
 *
 * Importer banktransaksjoner fra CSV (DNB, Nordea, Sparebank 1, Handelsbanken)
 * og match dem mot bokførte bilag.
 *
 * Formål: sikre at regnskapet stemmer med bankens kontoutskrift.
 * Regnskapsmessig krav: Bokfl. § 7 — kontrollsporet mellom bilag og bank.
 */

import { useState, useRef, useCallback } from "react";
import {
  Landmark,
  Upload,
  CheckCircle2,
  AlertCircle,
  Link2,
  Link2Off,
  RotateCcw,
  Trash2,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SlideIn, StaggerList, StaggerItem } from "@/components/motion";
import { useAuth } from "@/hooks/use-auth";
import { useAktivKlient } from "@/hooks/use-aktiv-klient";
import { useBilag } from "@/hooks/use-bilag";
import {
  useBankAvstemming,
  parseBankCSV,
  finnMatchKandidater,
  type BankTransaksjonMedId,
} from "@/hooks/use-bank-avstemming";
import { showToast } from "@/lib/toast";

// ─── Formatering ─────────────────────────────────────────────────────────────

function formatNOK(v: number) {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
}

// ─── Status-badge ────────────────────────────────────────────────────────────

const statusKonfig = {
  matchet: { label: "Auto-matchet", variant: "default" as const, farge: "text-green-500" },
  manuelt_koblet: { label: "Manuelt koblet", variant: "default" as const, farge: "text-blue-500" },
  umatchet: { label: "Umatchet", variant: "destructive" as const, farge: "text-red-500" },
  ignorert: { label: "Ignorert", variant: "secondary" as const, farge: "text-muted-foreground" },
};

// ─── Transaksjons-rad ─────────────────────────────────────────────────────────

function TransaksjonsRad({
  t,
  bilag,
  onKoble,
  onIgnorer,
}: {
  t: BankTransaksjonMedId;
  bilag: ReturnType<typeof useBilag>["bilag"];
  onKoble: (tId: string, bId: string) => void;
  onIgnorer: (tId: string) => void;
}) {
  const [visKandidater, setVisKandidater] = useState(false);
  const kandidater = finnMatchKandidater(t, bilag);
  const kobletBilag = t.bilagId ? bilag.find((b) => b.id === t.bilagId) : null;
  const cfg = statusKonfig[t.status];

  return (
    <div className={`rounded-lg border px-3 py-2.5 ${
      t.status === "umatchet" ? "border-red-500/20 bg-red-500/5" :
      t.status === "ignorert" ? "border-border/30 opacity-50" :
      "border-border/50"
    }`}>
      <div className="flex items-start gap-2">
        {/* Dato og beløp */}
        <div className="shrink-0 text-right min-w-[80px]">
          <p className={`text-sm font-mono font-medium ${t.beløp >= 0 ? "text-green-600" : "text-red-600"}`}>
            {t.beløp >= 0 ? "+" : ""}{formatNOK(t.beløp)}
          </p>
          <p className="text-[10px] text-muted-foreground">{t.dato}</p>
        </div>

        {/* Beskrivelse */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{t.beskrivelseBank}</p>
          {kobletBilag && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              → Bilag #{kobletBilag.bilagsnr}: {kobletBilag.beskrivelse}
            </p>
          )}
          {t.referanse && (
            <p className="text-[10px] text-muted-foreground font-mono">{t.referanse}</p>
          )}
        </div>

        {/* Status og handlinger */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge variant={cfg.variant} className="text-[10px] px-1.5 h-4">
            {cfg.label}
          </Badge>
          {t.status === "umatchet" && kandidater.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[10px]"
              onClick={() => setVisKandidater((v) => !v)}
            >
              {visKandidater ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              {kandidater.length}
            </Button>
          )}
          {t.status === "umatchet" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[10px] text-muted-foreground"
              onClick={() => onIgnorer(t.id)}
            >
              <EyeOff className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Match-kandidater */}
      {visKandidater && kandidater.length > 0 && (
        <div className="mt-2 space-y-1 pl-[88px]">
          {kandidater.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between rounded border border-border/40 px-2 py-1 bg-background text-xs"
            >
              <span>
                #{b.bilagsnr} — {b.beskrivelse}
                <span className="text-muted-foreground ml-1 font-mono">
                  ({formatNOK(b.belop)} · {b.dato})
                </span>
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-5 px-2 text-[10px] ml-2"
                onClick={() => {
                  onKoble(t.id, b.id);
                  setVisKandidater(false);
                }}
              >
                <Link2 className="h-3 w-3 mr-1" />
                Koble
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Hoved-side ───────────────────────────────────────────────────────────────

export default function BankAvstemmingPage() {
  const { user } = useAuth();
  const { aktivKlientId } = useAktivKlient();
  const { bilag } = useBilag(user?.uid ?? null, aktivKlientId);
  const {
    transaksjoner,
    loading,
    statistikk,
    importerTransaksjoner,
    kobleTransaksjon,
    automatchTransaksjoner,
    ignorer,
    slettAlle,
  } = useBankAvstemming(user?.uid ?? null);

  const filRef = useRef<HTMLInputElement>(null);
  const [filterStatus, setFilterStatus] = useState<BankTransaksjonMedId["status"] | "alle">("alle");
  const [importerer, setImporterer] = useState(false);
  const [matcher, setMatcher] = useState(false);

  const filtrerte = transaksjoner.filter((t) =>
    filterStatus === "alle" || t.status === filterStatus
  );

  const handleFilImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fil = e.target.files?.[0];
    if (!fil) return;
    setImporterer(true);
    try {
      const tekst = await fil.text();
      const parsed = parseBankCSV(tekst);
      if (parsed.length === 0) {
        showToast.error("Ingen transaksjoner funnet. Sjekk at filen er i riktig CSV-format.");
        return;
      }
      const antall = await importerTransaksjoner(parsed);
      showToast.success(`${antall} transaksjoner importert.`);
    } catch {
      showToast.error("Klarte ikke lese filen.");
    } finally {
      setImporterer(false);
      e.target.value = "";
    }
  }, [importerTransaksjoner]);

  const handleAutoMatch = useCallback(async () => {
    setMatcher(true);
    try {
      const matchet = await automatchTransaksjoner(bilag);
      showToast.success(`${matchet} transaksjoner auto-matchet.`);
    } finally {
      setMatcher(false);
    }
  }, [automatchTransaksjoner, bilag]);

  const matchRate = statistikk.totalt > 0
    ? Math.round(((statistikk.matchet) / statistikk.totalt) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* ── Topptekst ── */}
      <SlideIn>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Landmark className="h-6 w-6 text-primary" />
              Bankkontoavstemming
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Importer kontoutskrift og verifiser at regnskapet stemmer med banken.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {transaksjoner.length > 0 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAutoMatch}
                  disabled={matcher || statistikk.umatchet === 0}
                >
                  <RotateCcw className={`mr-2 h-4 w-4 ${matcher ? "animate-spin" : ""}`} />
                  Auto-match ({statistikk.umatchet})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/30"
                  onClick={async () => {
                    if (confirm("Slett alle importerte transaksjoner?")) await slettAlle();
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Slett alle
                </Button>
              </>
            )}
            <Button
              size="sm"
              onClick={() => filRef.current?.click()}
              disabled={importerer}
            >
              <Upload className="mr-2 h-4 w-4" />
              {importerer ? "Importerer…" : "Importer CSV"}
            </Button>
            <input
              ref={filRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={handleFilImport}
            />
          </div>
        </div>
      </SlideIn>

      {/* ── KPI-kort ── */}
      {transaksjoner.length > 0 && (
        <SlideIn>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Totalt", value: statistikk.totalt, farge: "text-foreground" },
              { label: "Matchet", value: statistikk.matchet, farge: "text-green-600" },
              { label: "Umatchet", value: statistikk.umatchet, farge: "text-red-600" },
              { label: "Match-rate", value: `${matchRate}%`, farge: matchRate >= 80 ? "text-green-600" : "text-orange-600" },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="pt-4 pb-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{s.label}</p>
                  <p className={`text-2xl font-bold mt-0.5 ${s.farge}`}>{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </SlideIn>
      )}

      {/* ── Fremgangslinje ── */}
      {transaksjoner.length > 0 && (
        <SlideIn>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Avstemmingsfremdrift</span>
              <span>{statistikk.matchet} av {statistikk.totalt - statistikk.ignorert} ({matchRate}%)</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${matchRate >= 80 ? "bg-green-500" : "bg-orange-500"}`}
                style={{ width: `${matchRate}%` }}
              />
            </div>
          </div>
        </SlideIn>
      )}

      {/* ── Tom tilstand ── */}
      {!loading && transaksjoner.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Landmark className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Ingen banktransaksjoner importert</p>
            <p className="text-sm mt-1 max-w-md mx-auto">
              Eksporter kontoutskriften fra nettbanken som CSV og importer den her.
              Støttede banker: DNB, Nordea, Sparebank 1, Handelsbanken.
            </p>
            <Button className="mt-4" onClick={() => filRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              Importer CSV-fil
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Filter + liste ── */}
      {transaksjoner.length > 0 && (
        <SlideIn>
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-sm">Transaksjoner</CardTitle>
                {(["alle", "umatchet", "matchet", "manuelt_koblet", "ignorert"] as const).map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={filterStatus === s ? "default" : "outline"}
                    className="h-6 px-2 text-[10px]"
                    onClick={() => setFilterStatus(s)}
                  >
                    {s === "alle" ? "Alle" :
                     s === "umatchet" ? `Umatchet (${statistikk.umatchet})` :
                     s === "matchet" ? "Auto-matchet" :
                     s === "manuelt_koblet" ? "Manuelt koblet" : "Ignorert"}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 rounded-lg" />
                ))
              ) : filtrerte.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Ingen transaksjoner i valgt kategori.
                </p>
              ) : (
                filtrerte.map((t) => (
                  <TransaksjonsRad
                    key={t.id}
                    t={t}
                    bilag={bilag}
                    onKoble={kobleTransaksjon}
                    onIgnorer={ignorer}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </SlideIn>
      )}

      {/* ── Brukerveiledning ── */}
      <SlideIn>
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Slik fungerer bankavstemmingen</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2">
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  trinn: "1",
                  tittel: "Eksporter fra nettbanken",
                  tekst: "Gå til nettbanken og eksporter kontoutskrift som CSV for ønsket periode.",
                },
                {
                  trinn: "2",
                  tittel: "Importer her",
                  tekst: "Last opp CSV-filen. Systemet støtter DNB, Nordea, Sparebank 1 og Handelsbanken.",
                },
                {
                  trinn: "3",
                  tittel: "Match og verifiser",
                  tekst: "Kjør auto-match. Transaksjoner med nøyaktig beløp ±3 dager kobles automatisk.",
                },
              ].map((s) => (
                <div key={s.trinn} className="flex gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold shrink-0">
                    {s.trinn}
                  </span>
                  <div>
                    <p className="font-medium text-foreground">{s.tittel}</p>
                    <p className="mt-0.5">{s.tekst}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </SlideIn>
    </div>
  );
}
