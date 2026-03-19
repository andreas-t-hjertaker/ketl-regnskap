"use client";

import { useState } from "react";
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
import {
  Upload,
  Receipt,
  Bot,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Eye,
} from "lucide-react";
import { SlideIn, StaggerList, StaggerItem } from "@/components/motion";
import type { Bilag } from "@/types";

// Demo-data
const mockBilag: (Bilag & { id: string })[] = [
  {
    id: "b-001",
    bilagsnr: 1001,
    dato: "2026-03-01",
    beskrivelse: "Faktura — Microsoft 365",
    belop: 2490,
    klientId: "klient-1",
    status: "bokført",
    kategori: "Programvarekostnader",
    leverandor: "Microsoft Ireland",
    posteringer: [
      { kontonr: "6860", kontonavn: "Programvare og lisenser", debet: 1992, kredit: 0 },
      { kontonr: "2710", kontonavn: "Inngående MVA", debet: 498, kredit: 0 },
      { kontonr: "2400", kontonavn: "Leverandørgjeld", debet: 0, kredit: 2490 },
    ],
  },
  {
    id: "b-002",
    bilagsnr: 1002,
    dato: "2026-03-03",
    beskrivelse: "Faktura — Telenor Bedrift",
    belop: 3240,
    klientId: "klient-1",
    status: "bokført",
    kategori: "Telekommunikasjon",
    leverandor: "Telenor AS",
    posteringer: [
      { kontonr: "6900", kontonavn: "Telekommunikasjon", debet: 2592, kredit: 0 },
      { kontonr: "2710", kontonavn: "Inngående MVA", debet: 648, kredit: 0 },
      { kontonr: "2400", kontonavn: "Leverandørgjeld", debet: 0, kredit: 3240 },
    ],
  },
  {
    id: "b-003",
    bilagsnr: 1003,
    dato: "2026-03-05",
    beskrivelse: "Kvittering — Kiwi Storgata",
    belop: 347,
    klientId: "klient-1",
    status: "foreslått",
    kategori: "Kontorkostnader",
    leverandor: "Kiwi",
    posteringer: [],
    aiForslag: {
      posteringer: [
        { kontonr: "6600", kontonavn: "Kontorkostnader", debet: 277.6, kredit: 0 },
        { kontonr: "2710", kontonavn: "Inngående MVA", debet: 69.4, kredit: 0 },
        { kontonr: "2400", kontonavn: "Leverandørgjeld", debet: 0, kredit: 347 },
      ],
      begrunnelse: "Basert på leverandørnavn og beløp klassifisert som kontorkostnader.",
      konfidens: 0.82,
      foreslåttKategori: "Kontorkostnader",
      tidspunkt: new Date("2026-03-05T10:14:00"),
    },
  },
  {
    id: "b-004",
    bilagsnr: 1004,
    dato: "2026-03-07",
    beskrivelse: "Faktura — Hafslund Nett (strøm)",
    belop: 4180,
    klientId: "klient-1",
    status: "foreslått",
    kategori: "Energi",
    leverandor: "Hafslund Nett AS",
    posteringer: [],
    aiForslag: {
      posteringer: [
        { kontonr: "6730", kontonavn: "Strøm, fyring og vann", debet: 3344, kredit: 0 },
        { kontonr: "2710", kontonavn: "Inngående MVA", debet: 836, kredit: 0 },
        { kontonr: "2400", kontonavn: "Leverandørgjeld", debet: 0, kredit: 4180 },
      ],
      begrunnelse: "Strømfaktura fra nettselskap. MVA 25%.",
      konfidens: 0.95,
      foreslåttKategori: "Energi",
      tidspunkt: new Date("2026-03-07T09:02:00"),
    },
  },
  {
    id: "b-005",
    bilagsnr: 1005,
    dato: "2026-03-10",
    beskrivelse: "Faktura — Adobe Creative Cloud",
    belop: 1890,
    klientId: "klient-1",
    status: "ubehandlet",
    leverandor: "Adobe Inc.",
    posteringer: [],
  },
  {
    id: "b-006",
    bilagsnr: 1006,
    dato: "2026-03-12",
    beskrivelse: "Reiseregning — Oslo–Bergen",
    belop: 1450,
    klientId: "klient-1",
    status: "ubehandlet",
    leverandor: "VY Group AS",
    posteringer: [],
  },
  {
    id: "b-007",
    bilagsnr: 1007,
    dato: "2026-03-14",
    beskrivelse: "Faktura — Regnskap AS (lønn)",
    belop: 68500,
    klientId: "klient-1",
    status: "bokført",
    kategori: "Lønnskostnader",
    leverandor: "Regnskap AS",
    posteringer: [
      { kontonr: "5000", kontonavn: "Lønn ansatte", debet: 68500, kredit: 0 },
      { kontonr: "2910", kontonavn: "Skyldig lønn", debet: 0, kredit: 68500 },
    ],
  },
  {
    id: "b-008",
    bilagsnr: 1008,
    dato: "2026-03-15",
    beskrivelse: "Kvittering — Parkering Oslo S",
    belop: 120,
    klientId: "klient-1",
    status: "avvist",
    leverandor: "Apcoa Parking",
    posteringer: [],
  },
];

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
};

const statusIkon: Record<Bilag["status"], React.ElementType> = {
  bokført: CheckCircle2,
  foreslått: Bot,
  ubehandlet: Clock,
  avvist: XCircle,
};

function formatNOK(value: number) {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

const tableData: BilagRow[] = mockBilag.map((b) => ({
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

export default function BilagPage() {
  const [dragOver, setDragOver] = useState(false);
  const [selectedBilag, setSelectedBilag] = useState<(Bilag & { id: string }) | null>(null);

  const antallUbehandlet = mockBilag.filter((b) => b.status === "ubehandlet").length;
  const antallForeslått = mockBilag.filter((b) => b.status === "foreslått").length;

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
          <Button>
            <Upload className="mr-2 h-4 w-4" />
            Last opp bilag
          </Button>
        </div>
      </SlideIn>

      {/* Statistikk-kort */}
      <StaggerList className="grid gap-4 sm:grid-cols-4" staggerDelay={0.06}>
        {[
          { label: "Totalt", value: mockBilag.length, icon: Receipt, color: "text-foreground" },
          { label: "Ubehandlet", value: antallUbehandlet, icon: AlertCircle, color: "text-orange-500" },
          { label: "AI-forslag", value: antallForeslått, icon: Bot, color: "text-blue-500" },
          { label: "Bokført", value: mockBilag.filter(b => b.status === "bokført").length, icon: CheckCircle2, color: "text-green-500" },
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

      {/* Dra-og-slipp opplastingssone */}
      <SlideIn direction="up" delay={0.15}>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); }}
          className={`rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
            dragOver
              ? "border-primary bg-primary/5"
              : "border-border/50 hover:border-border hover:bg-accent/20"
          }`}
        >
          <Upload className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Dra filer hit, eller klikk for å velge</p>
          <p className="mt-1 text-xs text-muted-foreground">
            PDF, JPG, PNG — AI analyserer og foreslår bokføring automatisk
          </p>
          <Button variant="outline" size="sm" className="mt-4">
            Velg filer
          </Button>
        </div>
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
              <Button variant="ghost" size="sm" onClick={() => setSelectedBilag(null)}>
                Lukk
              </Button>
            </CardHeader>
            {selectedBilag.aiForslag && (
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
                  <Button size="sm">
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Godkjenn og bokfør
                  </Button>
                  <Button variant="outline" size="sm">
                    Rediger
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive">
                    Avvis
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>
        </SlideIn>
      )}

      {/* DataTable */}
      <SlideIn direction="up" delay={0.2}>
        <DataTable
          data={tableData}
          columns={[
            ...columns,
            {
              key: "id",
              header: "",
              sortable: false,
              render: (value) => {
                const bilag = mockBilag.find((b) => b.id === value);
                if (!bilag) return null;
                return (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedBilag(bilag)}
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
      </SlideIn>
    </div>
  );
}
