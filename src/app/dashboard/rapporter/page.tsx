"use client";

import { useState } from "react";
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
  FileBarChart,
  Download,
  TrendingUp,
  TrendingDown,
  BarChart3,
  FileText,
  AlertCircle,
} from "lucide-react";
import { SlideIn, StaggerList, StaggerItem } from "@/components/motion";

type Periode = "2026-01" | "2026-02" | "2026-03" | "2026";

function formatNOK(value: number) {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// Demo-data
const resultatregnskap: Record<Periode, {
  driftsinntekter: { konto: string; navn: string; belop: number }[];
  driftskostnader: { konto: string; navn: string; belop: number }[];
}> = {
  "2026-01": {
    driftsinntekter: [
      { konto: "3000", navn: "Salgsinntekter, avgiftspliktig", belop: 380000 },
      { konto: "3100", navn: "Salgsinntekter, avgiftsfri", belop: 30000 },
    ],
    driftskostnader: [
      { konto: "5000", navn: "Lønnskostnader", belop: 185000 },
      { konto: "6000", navn: "Avskrivninger", belop: 15000 },
      { konto: "6860", navn: "Programvare og lisenser", belop: 12000 },
      { konto: "6900", navn: "Telekommunikasjon", belop: 8400 },
      { konto: "6730", navn: "Strøm og oppvarming", belop: 6800 },
      { konto: "7000", navn: "Driftsmateriell", belop: 4200 },
      { konto: "7100", navn: "Frakt og transport", belop: 2800 },
      { konto: "7320", navn: "Revisor og regnskapshjelp", belop: 18000 },
      { konto: "7770", navn: "Bank- og finanskostnader", belop: 1800 },
    ],
  },
  "2026-02": {
    driftsinntekter: [
      { konto: "3000", navn: "Salgsinntekter, avgiftspliktig", belop: 400000 },
      { konto: "3100", navn: "Salgsinntekter, avgiftsfri", belop: 32000 },
    ],
    driftskostnader: [
      { konto: "5000", navn: "Lønnskostnader", belop: 185000 },
      { konto: "6000", navn: "Avskrivninger", belop: 15000 },
      { konto: "6860", navn: "Programvare og lisenser", belop: 13400 },
      { konto: "6900", navn: "Telekommunikasjon", belop: 8400 },
      { konto: "6730", navn: "Strøm og oppvarming", belop: 5200 },
      { konto: "7000", navn: "Driftsmateriell", belop: 3800 },
      { konto: "7100", navn: "Frakt og transport", belop: 2600 },
      { konto: "7320", navn: "Revisor og regnskapshjelp", belop: 18000 },
      { konto: "7770", navn: "Bank- og finanskostnader", belop: 1600 },
    ],
  },
  "2026-03": {
    driftsinntekter: [
      { konto: "3000", navn: "Salgsinntekter, avgiftspliktig", belop: 450000 },
      { konto: "3100", navn: "Salgsinntekter, avgiftsfri", belop: 35000 },
    ],
    driftskostnader: [
      { konto: "5000", navn: "Lønnskostnader", belop: 192000 },
      { konto: "6000", navn: "Avskrivninger", belop: 15000 },
      { konto: "6860", navn: "Programvare og lisenser", belop: 14200 },
      { konto: "6900", navn: "Telekommunikasjon", belop: 8400 },
      { konto: "6730", navn: "Strøm og oppvarming", belop: 4180 },
      { konto: "7000", navn: "Driftsmateriell", belop: 3800 },
      { konto: "7100", navn: "Frakt og transport", belop: 3100 },
      { konto: "7320", navn: "Revisor og regnskapshjelp", belop: 18000 },
      { konto: "7770", navn: "Bank- og finanskostnader", belop: 1720 },
    ],
  },
  "2026": {
    driftsinntekter: [
      { konto: "3000", navn: "Salgsinntekter, avgiftspliktig", belop: 1230000 },
      { konto: "3100", navn: "Salgsinntekter, avgiftsfri", belop: 97000 },
    ],
    driftskostnader: [
      { konto: "5000", navn: "Lønnskostnader", belop: 562000 },
      { konto: "6000", navn: "Avskrivninger", belop: 45000 },
      { konto: "6860", navn: "Programvare og lisenser", belop: 39600 },
      { konto: "6900", navn: "Telekommunikasjon", belop: 25200 },
      { konto: "6730", navn: "Strøm og oppvarming", belop: 16180 },
      { konto: "7000", navn: "Driftsmateriell", belop: 11800 },
      { konto: "7100", navn: "Frakt og transport", belop: 8500 },
      { konto: "7320", navn: "Revisor og regnskapshjelp", belop: 54000 },
      { konto: "7770", navn: "Bank- og finanskostnader", belop: 5120 },
    ],
  },
};

const periodeLabels: Record<Periode, string> = {
  "2026-01": "Januar 2026",
  "2026-02": "Februar 2026",
  "2026-03": "Mars 2026",
  "2026": "Hele 2026",
};

const mvaData = [
  { periode: "Termin 1 (jan–feb)", utgåendeMva: 107000, inngåendeMva: 43400, å_betale: 63600, status: "levert" },
  { periode: "Termin 2 (mar–apr)", utgåendeMva: 112500, inngåendeMva: 38200, å_betale: 74300, status: "utkast" },
];

const balanseData = {
  eiendeler: [
    { konto: "1200", navn: "Maskiner og inventar", belop: 240000 },
    { konto: "1500", navn: "Kundefordringer", belop: 185000 },
    { konto: "1900", navn: "Bankinnskudd", belop: 842000 },
    { konto: "1940", navn: "Skattetrekkskonto", belop: 95000 },
  ],
  gjeldOgEgenkapital: [
    { konto: "2000", navn: "Aksjekapital", belop: 100000 },
    { konto: "2050", navn: "Annen egenkapital", belop: 640000 },
    { konto: "2400", navn: "Leverandørgjeld", belop: 198000 },
    { konto: "2600", navn: "Skattetrekk og arbeidsgiveravgift", belop: 95000 },
    { konto: "2700", navn: "Skyldig MVA", belop: 74300 },
    { konto: "2800", navn: "Annen kortsiktig gjeld", belop: 254700 },
  ],
};

export default function RapporterPage() {
  const [valgtPeriode, setValgtPeriode] = useState<Periode>("2026-03");
  const [aktivFane, setAktivFane] = useState<"resultat" | "balanse" | "mva" | "saft">("resultat");

  const data = resultatregnskap[valgtPeriode];
  const totalInntekter = data.driftsinntekter.reduce((s, r) => s + r.belop, 0);
  const totalKostnader = data.driftskostnader.reduce((s, r) => s + r.belop, 0);
  const resultat = totalInntekter - totalKostnader;

  const totalEiendeler = balanseData.eiendeler.reduce((s, r) => s + r.belop, 0);
  const totalGjeld = balanseData.gjeldOgEgenkapital.reduce((s, r) => s + r.belop, 0);

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
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Eksporter
          </Button>
        </div>
      </SlideIn>

      {/* Periodevalgknapper */}
      <SlideIn direction="up" delay={0.1}>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(periodeLabels) as Periode[]).map((p) => (
            <Button
              key={p}
              variant={valgtPeriode === p ? "default" : "outline"}
              size="sm"
              onClick={() => setValgtPeriode(p)}
            >
              {periodeLabels[p]}
            </Button>
          ))}
        </div>
      </SlideIn>

      {/* Fanenavigasjon */}
      <SlideIn direction="up" delay={0.15}>
        <div className="flex gap-1 rounded-lg border border-border/50 p-1 w-fit">
          {[
            { id: "resultat" as const, label: "Resultatregnskap", icon: TrendingUp },
            { id: "balanse" as const, label: "Balanse", icon: BarChart3 },
            { id: "mva" as const, label: "MVA-rapport", icon: FileText },
            { id: "saft" as const, label: "SAF-T", icon: FileBarChart },
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

      {/* Resultatregnskap */}
      {aktivFane === "resultat" && (
        <div className="space-y-4">
          {/* Sammendrag */}
          <StaggerList className="grid gap-4 sm:grid-cols-3" staggerDelay={0.07}>
            {[
              { label: "Driftsinntekter", value: totalInntekter, icon: TrendingUp, color: "text-green-500" },
              { label: "Driftskostnader", value: totalKostnader, icon: TrendingDown, color: "text-red-500" },
              { label: "Driftsresultat", value: resultat, icon: BarChart3, color: resultat > 0 ? "text-green-600" : "text-red-500" },
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
                  Resultatregnskap — {periodeLabels[valgtPeriode]}
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
                    {data.driftsinntekter.map((r) => (
                      <tr key={r.konto} className="border-t border-border/30">
                        <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{r.konto}</td>
                        <td className="px-4 py-2">{r.navn}</td>
                        <td className="px-4 py-2 text-right font-medium text-green-600">{formatNOK(r.belop)}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-border bg-muted/20">
                      <td className="px-4 py-2 font-mono text-xs"></td>
                      <td className="px-4 py-2 font-semibold">Sum driftsinntekter</td>
                      <td className="px-4 py-2 text-right font-bold text-green-600">{formatNOK(totalInntekter)}</td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground bg-muted/30">
                        Driftskostnader
                      </td>
                    </tr>
                    {data.driftskostnader.map((r) => (
                      <tr key={r.konto} className="border-t border-border/30">
                        <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{r.konto}</td>
                        <td className="px-4 py-2">{r.navn}</td>
                        <td className="px-4 py-2 text-right font-medium text-red-500">{formatNOK(r.belop)}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-border bg-muted/20">
                      <td className="px-4 py-2 font-mono text-xs"></td>
                      <td className="px-4 py-2 font-semibold">Sum driftskostnader</td>
                      <td className="px-4 py-2 text-right font-bold text-red-500">{formatNOK(totalKostnader)}</td>
                    </tr>
                    <tr className="border-t-2 border-border">
                      <td className="px-4 py-3 font-mono text-xs"></td>
                      <td className="px-4 py-3 font-bold text-base">Driftsresultat</td>
                      <td className={`px-4 py-3 text-right font-bold text-base ${resultat > 0 ? "text-green-600" : "text-red-500"}`}>
                        {formatNOK(resultat)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </SlideIn>
        </div>
      )}

      {/* Balanse */}
      {aktivFane === "balanse" && (
        <SlideIn direction="up">
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
                    {balanseData.eiendeler.map((r) => (
                      <tr key={r.konto} className="border-t border-border/30">
                        <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{r.konto}</td>
                        <td className="px-4 py-2">{r.navn}</td>
                        <td className="px-4 py-2 text-right font-medium">{formatNOK(r.belop)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-border bg-muted/20">
                      <td className="px-4 py-3"></td>
                      <td className="px-4 py-3 font-bold">Sum eiendeler</td>
                      <td className="px-4 py-3 text-right font-bold">{formatNOK(totalEiendeler)}</td>
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
                    {balanseData.gjeldOgEgenkapital.map((r) => (
                      <tr key={r.konto} className="border-t border-border/30">
                        <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{r.konto}</td>
                        <td className="px-4 py-2">{r.navn}</td>
                        <td className="px-4 py-2 text-right font-medium">{formatNOK(r.belop)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-border bg-muted/20">
                      <td className="px-4 py-3"></td>
                      <td className="px-4 py-3 font-bold">Sum gjeld og EK</td>
                      <td className="px-4 py-3 text-right font-bold">{formatNOK(totalGjeld)}</td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </SlideIn>
      )}

      {/* MVA-rapport */}
      {aktivFane === "mva" && (
        <div className="space-y-4">
          <StaggerList className="space-y-4" staggerDelay={0.08}>
            {mvaData.map((termin) => (
              <StaggerItem key={termin.periode}>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <div>
                      <CardTitle className="text-base">{termin.periode}</CardTitle>
                    </div>
                    <Badge variant={termin.status === "levert" ? "default" : "outline"}>
                      {termin.status === "levert" ? "Levert" : "Utkast"}
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
                        <p className="mt-1 text-lg font-bold text-primary">{formatNOK(termin.å_betale)}</p>
                      </div>
                    </div>
                    {termin.status === "utkast" && (
                      <div className="mt-3 flex gap-2">
                        <Button size="sm">Send MVA-melding</Button>
                        <Button variant="outline" size="sm">Forhåndsvis</Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </StaggerItem>
            ))}
          </StaggerList>
        </div>
      )}

      {/* SAF-T */}
      {aktivFane === "saft" && (
        <SlideIn direction="up">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileBarChart className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">SAF-T-eksport</CardTitle>
              </div>
              <CardDescription>
                Standard Audit File for Tax — norsk format for myndighetskrav og revisjon.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Funksjon under utvikling</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    SAF-T-eksport vil være tilgjengelig i neste versjon. Filen vil inneholde
                    alle transaksjoner i henhold til Skatteetatens krav til SAF-T Financial.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-medium">Hva inkluderes i SAF-T-filen</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {[
                    "Kontoplan (NS 4102)",
                    "Kunder og leverandører",
                    "Alle bilag og posteringer",
                    "MVA-transaksjoner og koder",
                    "Åpningsbalanse og periodesaldi",
                  ].map((punkt) => (
                    <li key={punkt} className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                      {punkt}
                    </li>
                  ))}
                </ul>
              </div>

              <Button disabled>
                <Download className="mr-2 h-4 w-4" />
                Generer SAF-T XML (kommer snart)
              </Button>
            </CardContent>
          </Card>
        </SlideIn>
      )}
    </div>
  );
}
