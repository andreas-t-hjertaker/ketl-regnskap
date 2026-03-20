"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
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
  Upload,
  Receipt,
  Bot,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Eye,
  ExternalLink,
  RotateCcw,
  Archive,
  Download,
  X,
  PenLine,
} from "lucide-react";
import { eksporterBilagCsv, eksporterPosteringerCsv } from "@/lib/eksport";
import { SlideIn, StaggerList, StaggerItem } from "@/components/motion";
import { useAuth } from "@/hooks/use-auth";
import { useBilag, type BilagMedId } from "@/hooks/use-bilag";
import { useBilagUpload } from "@/hooks/use-bilag-upload";
import type { Bilag } from "@/types";

type BilagRow = {
  id: string;
  bilagsnr: number;
  dato: string;
  beskrivelse: string;
  leverandor: string;
  belop: string;
  status: Bilag["status"];
  kategori: string;
};

const statusBadge: Record<Bilag["status"], { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  bokført: { label: "Bokført", variant: "default" },
  foreslått: { label: "Foreslått", variant: "secondary" },
  ubehandlet: { label: "Ubehandlet", variant: "outline" },
  avvist: { label: "Avvist", variant: "destructive" },
  kreditert: { label: "Kreditert", variant: "outline" },
  arkivert: { label: "Arkivert", variant: "secondary" },
};

const statusIkon: Record<Bilag["status"], React.ElementType> = {
  bokført: CheckCircle2,
  foreslått: Bot,
  ubehandlet: Clock,
  avvist: XCircle,
  kreditert: RotateCcw,
  arkivert: Archive,
};

function formatNOK(value: number) {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function BilagPage() {
  const { user } = useAuth();
  const { bilag, loading, godkjennBilag, avvisBilag, krediterBilag } = useBilag(user?.uid ?? null);
  const { uploadFlere, lasterOpp, fremdrift } = useBilagUpload(user?.uid ?? null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedBilag, setSelectedBilag] = useState<BilagMedId | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const antallUbehandlet = bilag.filter((b) => b.status === "ubehandlet").length;
  const antallForeslått = bilag.filter((b) => b.status === "foreslått").length;

  // ── Filtrering ──────────────────────────────────────────────────────────────
  const [filterStatus, setFilterStatus] = useState<Bilag["status"] | "alle">("alle");
  const [filterFra, setFilterFra] = useState("");
  const [filterTil, setFilterTil] = useState("");

  const filtrerteBilag = useMemo(() => {
    return bilag.filter((b) => {
      if (filterStatus !== "alle" && b.status !== filterStatus) return false;
      if (filterFra && b.dato < filterFra) return false;
      if (filterTil && b.dato > filterTil) return false;
      return true;
    });
  }, [bilag, filterStatus, filterFra, filterTil]);

  const harAktiveFiltre = filterStatus !== "alle" || filterFra !== "" || filterTil !== "";

  const tableData: BilagRow[] = filtrerteBilag.map((b) => ({
    id: b.id,
    bilagsnr: b.bilagsnr,
    dato: b.dato,
    beskrivelse: b.beskrivelse,
    leverandor: b.leverandor ?? "—",
    belop: formatNOK(b.belop),
    status: b.status,
    kategori: b.kategori ?? "—",
  }));

  const columns: ColumnDef<BilagRow>[] = [
    { key: "bilagsnr", header: "Nr.", sortable: true },
    { key: "dato", header: "Dato", sortable: true },
    { key: "beskrivelse", header: "Beskrivelse", sortable: true },
    { key: "leverandor", header: "Leverandør", sortable: true },
    { key: "belop", header: "Beløp", sortable: false },
    { key: "kategori", header: "Kategori", sortable: true },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (value) => {
        const s = value as Bilag["status"];
        const cfg = statusBadge[s];
        const Ikon = statusIkon[s];
        return (
          <Badge variant={cfg.variant} className="gap-1">
            <Ikon className="h-3 w-3" />
            {cfg.label}
          </Badge>
        );
      },
    },
  ];

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const filer = Array.from(e.dataTransfer.files);
      if (filer.length > 0) await uploadFlere(filer);
    },
    [uploadFlere]
  );

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const filer = Array.from(e.target.files ?? []);
      if (filer.length > 0) await uploadFlere(filer);
      e.target.value = "";
    },
    [uploadFlere]
  );

  return (
    <div className="space-y-6">
      {/* Toppseksjon */}
      <SlideIn direction="up" duration={0.4}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Bilag</h1>
            <p className="text-muted-foreground">
              Administrer kvitteringer og fakturaer. AI foreslår bokføring automatisk.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/dashboard/bilag/ny">
              <Button variant="outline">
                <PenLine className="mr-2 h-4 w-4" />
                Nytt bilag
              </Button>
            </Link>
            <Button onClick={() => fileInputRef.current?.click()} disabled={lasterOpp}>
              <Upload className="mr-2 h-4 w-4" />
              {lasterOpp ? `Laster opp… ${fremdrift}%` : "Last opp bilag"}
            </Button>
          </div>
        </div>
      </SlideIn>

      {/* Statistikk-kort */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-3 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <StaggerList className="grid gap-4 sm:grid-cols-4" staggerDelay={0.06}>
          {[
            { label: "Totalt", value: bilag.length, icon: Receipt, color: "text-foreground" },
            { label: "Ubehandlet", value: antallUbehandlet, icon: AlertCircle, color: "text-orange-500" },
            { label: "AI-forslag", value: antallForeslått, icon: Bot, color: "text-blue-500" },
            { label: "Bokført", value: bilag.filter(b => b.status === "bokført").length, icon: CheckCircle2, color: "text-green-500" },
          ].map((stat) => (
            <StaggerItem key={stat.label}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardDescription className="text-xs">{stat.label}</CardDescription>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </StaggerList>
      )}

      {/* Dra-og-slipp opplastingssone */}
      <SlideIn direction="up" delay={0.15}>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
            dragOver
              ? "border-primary bg-primary/5"
              : "border-border/50 hover:border-border hover:bg-accent/20"
          }`}
        >
          <Upload className={`mx-auto mb-3 h-8 w-8 ${lasterOpp ? "text-primary animate-pulse" : "text-muted-foreground"}`} />
          {lasterOpp ? (
            <>
              <p className="text-sm font-medium">Laster opp… {fremdrift}%</p>
              <div className="mt-3 mx-auto max-w-xs rounded-full bg-border/50 h-2">
                <div
                  className="h-2 rounded-full bg-primary transition-all"
                  style={{ width: `${fremdrift}%` }}
                />
              </div>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">Dra filer hit, eller klikk for å velge</p>
              <p className="mt-1 text-xs text-muted-foreground">
                PDF, JPG, PNG, HEIC — maks 10 MB — AI analyserer og foreslår bokføring automatisk
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => fileInputRef.current?.click()}
              >
                Velg filer
              </Button>
            </>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.heic,.heif"
          className="hidden"
          onChange={handleFileChange}
        />
      </SlideIn>

      {/* Detaljvisning for valgt bilag */}
      {selectedBilag && (
        <SlideIn direction="up">
          <Card className="border-primary/30 bg-accent/10">
            <CardHeader className="flex flex-row items-start justify-between pb-3">
              <div>
                <CardTitle className="text-base">
                  Bilag #{selectedBilag.bilagsnr} — {selectedBilag.beskrivelse}
                </CardTitle>
                <CardDescription>
                  {selectedBilag.leverandor} · {selectedBilag.dato} · {formatNOK(selectedBilag.belop)}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {selectedBilag.vedleggUrl && (
                  <a
                    href={selectedBilag.vedleggUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center h-8 px-3 rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
                <Button variant="ghost" size="sm" onClick={() => setSelectedBilag(null)}>
                  Lukk
                </Button>
              </div>
            </CardHeader>
            {selectedBilag.aiForslag && selectedBilag.status === "foreslått" && (
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium">AI-forslag</span>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {Math.round(selectedBilag.aiForslag.konfidens * 100)}% konfidens
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{selectedBilag.aiForslag.begrunnelse}</p>
                <div className="rounded-lg border border-border/50 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Konto</th>
                        <th className="px-3 py-2 text-right font-medium">Debet</th>
                        <th className="px-3 py-2 text-right font-medium">Kredit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedBilag.aiForslag.posteringer.map((p, i) => (
                        <tr key={i} className="border-t border-border/30">
                          <td className="px-3 py-2 font-mono text-xs">
                            {p.kontonr} {p.kontonavn}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs">
                            {p.debet > 0 ? formatNOK(p.debet) : "—"}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs">
                            {p.kredit > 0 ? formatNOK(p.kredit) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={async () => {
                      await godkjennBilag(selectedBilag.id);
                      setSelectedBilag(null);
                    }}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Godkjenn og bokfør
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={async () => {
                      await avvisBilag(selectedBilag.id);
                      setSelectedBilag(null);
                    }}
                  >
                    Avvis
                  </Button>
                </div>
              </CardContent>
            )}
            {(!selectedBilag.aiForslag || selectedBilag.status !== "foreslått") && (
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {selectedBilag.status === "ubehandlet"
                    ? "AI-analyse pågår. Kom tilbake om litt."
                    : selectedBilag.status === "bokført"
                    ? "Dette bilaget er bokført."
                    : selectedBilag.status === "kreditert"
                    ? "Dette bilaget er kreditert og reversert."
                    : "Dette bilaget er avvist."}
                </p>
                {selectedBilag.status === "bokført" && !selectedBilag.kreditertAvId && (
                  <div className="mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive border-destructive/30 hover:bg-destructive/5"
                      onClick={async () => {
                        await krediterBilag(selectedBilag.id);
                        setSelectedBilag(null);
                      }}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Kreditér bilag
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">
                      Oppretter et korrigeringsbilag med reverserte posteringer (Bokfl. § 9).
                    </p>
                  </div>
                )}
                {selectedBilag.posteringer.length > 0 && (
                  <div className="mt-3 rounded-lg border border-border/50 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Konto</th>
                          <th className="px-3 py-2 text-right font-medium">Debet</th>
                          <th className="px-3 py-2 text-right font-medium">Kredit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedBilag.posteringer.map((p, i) => (
                          <tr key={i} className="border-t border-border/30">
                            <td className="px-3 py-2 font-mono text-xs">{p.kontonr} {p.kontonavn}</td>
                            <td className="px-3 py-2 text-right font-mono text-xs">{p.debet > 0 ? formatNOK(p.debet) : "—"}</td>
                            <td className="px-3 py-2 text-right font-mono text-xs">{p.kredit > 0 ? formatNOK(p.kredit) : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        </SlideIn>
      )}

      {/* Filter-panel */}
      {!loading && bilag.length > 0 && (
        <SlideIn direction="up" delay={0.17}>
          <Card className="border-border/40">
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-wrap gap-3 items-end">
                {/* Status-filter */}
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Status</p>
                  <div className="flex flex-wrap gap-1">
                    {(["alle", "ubehandlet", "foreslått", "bokført", "avvist", "kreditert", "arkivert"] as const).map((s) => (
                      <Button
                        key={s}
                        size="sm"
                        variant={filterStatus === s ? "default" : "outline"}
                        className="h-7 text-xs"
                        onClick={() => setFilterStatus(s)}
                      >
                        {s === "alle" ? "Alle" : statusBadge[s as Bilag["status"]]?.label ?? s}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Dato-filter */}
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Dato fra</p>
                  <Input
                    type="date"
                    value={filterFra}
                    onChange={(e) => setFilterFra(e.target.value)}
                    className="h-7 text-xs w-36"
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Dato til</p>
                  <Input
                    type="date"
                    value={filterTil}
                    onChange={(e) => setFilterTil(e.target.value)}
                    className="h-7 text-xs w-36"
                  />
                </div>

                {/* Tilbakestill */}
                {harAktiveFiltre && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => {
                      setFilterStatus("alle");
                      setFilterFra("");
                      setFilterTil("");
                    }}
                  >
                    <X className="mr-1 h-3 w-3" />
                    Nullstill filter
                  </Button>
                )}

                {harAktiveFiltre && (
                  <p className="text-xs text-muted-foreground self-end pb-0.5">
                    Viser {filtrerteBilag.length} av {bilag.length} bilag
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </SlideIn>
      )}

      {/* Eksport */}
      {!loading && bilag.length > 0 && (
        <SlideIn direction="up" delay={0.18}>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => eksporterBilagCsv(filtrerteBilag)}
            >
              <Download className="mr-2 h-4 w-4" />
              Eksporter bilagliste (CSV)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => eksporterPosteringerCsv(filtrerteBilag)}
            >
              <Download className="mr-2 h-4 w-4" />
              Posteringsliste (CSV)
            </Button>
          </div>
        </SlideIn>
      )}

      {/* DataTable */}
      <SlideIn direction="up" delay={0.2}>
        {loading ? (
          <Card>
            <CardContent className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </CardContent>
          </Card>
        ) : bilag.length === 0 ? (
          <div className="rounded-xl border border-border/40 py-16 text-center text-muted-foreground">
            <Receipt className="mx-auto mb-3 h-8 w-8 opacity-40" />
            <p className="text-sm font-medium">Ingen bilag ennå</p>
            <p className="text-xs mt-1">Last opp en kvittering eller faktura for å komme i gang.</p>
          </div>
        ) : (
          <DataTable
            data={tableData}
            columns={[
              ...columns,
              {
                key: "id",
                header: "",
                sortable: false,
                render: (value) => {
                  const b = bilag.find((x) => x.id === value);
                  if (!b) return null;
                  return (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedBilag(b)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  );
                },
              },
            ]}
            searchable
            searchKey="beskrivelse"
            pageSize={8}
          />
        )}
      </SlideIn>
    </div>
  );
}
