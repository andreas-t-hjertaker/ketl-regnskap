"use client";

import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  TrendingUp,
  TrendingDown,
  Receipt,
  AlertCircle,
  Bot,
  CheckCircle2,
  Clock,
  FileText,
  BarChart3,
} from "lucide-react";
import {
  SlideIn,
  StaggerList,
  StaggerItem,
  AnimatedCounter,
} from "@/components/motion";
import type { AgentAktivitet } from "@/types";

// Demo-data
const kpiData = [
  {
    label: "Omsetning (mars)",
    value: 485000,
    format: "nok",
    icon: TrendingUp,
    trend: "+12% vs. forrige måned",
    trendUp: true,
  },
  {
    label: "Kostnader (mars)",
    value: 312400,
    format: "nok",
    icon: TrendingDown,
    trend: "+3% vs. forrige måned",
    trendUp: false,
  },
  {
    label: "Resultat (mars)",
    value: 172600,
    format: "nok",
    icon: BarChart3,
    trend: "+28% vs. forrige måned",
    trendUp: true,
  },
  {
    label: "Ubehandlede bilag",
    value: 7,
    format: "count",
    icon: AlertCircle,
    trend: "Trenger gjennomgang",
    trendUp: false,
  },
];

const agentAktiviteter: AgentAktivitet[] = [
  {
    type: "bokføring",
    beskrivelse: "Bokførte faktura fra Telenor AS — 3 240 kr inkl. MVA",
    tidspunkt: new Date("2026-03-19T09:15:00"),
    klientId: "klient-1",
    bilagId: "bilag-42",
  },
  {
    type: "forslag",
    beskrivelse: "Foreslår konto 6540 for reiseutgift fra Ruter AS",
    tidspunkt: new Date("2026-03-19T08:47:00"),
    klientId: "klient-1",
    bilagId: "bilag-43",
  },
  {
    type: "rapport",
    beskrivelse: "Genererte MVA-rapport for periode 2026-02",
    tidspunkt: new Date("2026-03-18T16:30:00"),
    klientId: "klient-1",
  },
  {
    type: "bokføring",
    beskrivelse: "Bokførte 4 bilag fra Elgiganten — total 18 750 kr",
    tidspunkt: new Date("2026-03-18T14:20:00"),
    klientId: "klient-2",
  },
  {
    type: "avstemming",
    beskrivelse: "Bankkontoavstemming fullført for mars — 0 differanser",
    tidspunkt: new Date("2026-03-17T11:05:00"),
    klientId: "klient-1",
  },
];

const ubehandledeBilag = [
  {
    bilagsnr: 1043,
    beskrivelse: "Faktura — Adobe Inc.",
    belop: 1890,
    dato: "2026-03-18",
    leverandor: "Adobe Inc.",
  },
  {
    bilagsnr: 1044,
    beskrivelse: "Kvittering — Kiwi 1204",
    belop: 347,
    dato: "2026-03-18",
    leverandor: "Kiwi",
  },
  {
    bilagsnr: 1045,
    beskrivelse: "Faktura — Nettleie mars",
    belop: 2140,
    dato: "2026-03-17",
    leverandor: "Hafslund Nett",
  },
];

function formatNOK(value: number) {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function aktivitetIkon(type: AgentAktivitet["type"]) {
  const icons = {
    bokføring: CheckCircle2,
    forslag: Bot,
    rapport: FileText,
    epost: FileText,
    avstemming: BarChart3,
  };
  return icons[type] ?? Bot;
}

function aktivitetFarge(type: AgentAktivitet["type"]) {
  const farger = {
    bokføring: "text-green-500",
    forslag: "text-blue-500",
    rapport: "text-purple-500",
    epost: "text-orange-500",
    avstemming: "text-teal-500",
  };
  return farger[type] ?? "text-muted-foreground";
}

function tidSiden(dato: Date) {
  const diff = Math.floor((Date.now() - dato.getTime()) / 60000);
  if (diff < 60) return `${diff} min siden`;
  const timer = Math.floor(diff / 60);
  if (timer < 24) return `${timer}t siden`;
  return `${Math.floor(timer / 24)}d siden`;
}

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-8">
      {/* Velkomsthilsen */}
      <SlideIn direction="up" duration={0.4}>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            God morgen{user?.displayName ? `, ${user.displayName}` : ""}
          </h1>
          <p className="text-muted-foreground">
            Her er regnskapsoversikten din for mars 2026.
          </p>
        </div>
      </SlideIn>

      {/* KPI-kort */}
      <StaggerList className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" staggerDelay={0.08}>
        {kpiData.map((kpi) => (
          <StaggerItem key={kpi.label}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardDescription className="text-xs font-medium uppercase tracking-wide">
                  {kpi.label}
                </CardDescription>
                <kpi.icon
                  className={`h-4 w-4 ${kpi.trendUp ? "text-green-500" : kpi.label === "Ubehandlede bilag" ? "text-orange-500" : "text-red-500"}`}
                />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {kpi.format === "nok" ? (
                    formatNOK(kpi.value)
                  ) : (
                    <AnimatedCounter value={kpi.value} />
                  )}
                </p>
                <p className={`mt-1 text-xs ${kpi.trendUp ? "text-green-600" : "text-muted-foreground"}`}>
                  {kpi.trend}
                </p>
              </CardContent>
            </Card>
          </StaggerItem>
        ))}
      </StaggerList>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Siste aktivitet */}
        <div>
          <SlideIn direction="up" delay={0.1}>
            <div className="mb-4 flex items-center gap-3">
              <h2 className="text-lg font-semibold">Siste aktivitet</h2>
              <Badge variant="outline" className="font-mono text-xs">
                <Bot className="mr-1.5 h-3 w-3" />
                AI-agent
              </Badge>
            </div>
          </SlideIn>
          <StaggerList className="space-y-3" staggerDelay={0.06} initialDelay={0.15}>
            {agentAktiviteter.map((a, i) => {
              const Ikon = aktivitetIkon(a.type);
              return (
                <StaggerItem key={i}>
                  <div className="flex items-start gap-3 rounded-lg border border-border/50 bg-card/50 px-4 py-3">
                    <Ikon
                      className={`mt-0.5 h-4 w-4 shrink-0 ${aktivitetFarge(a.type)}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{a.beskrivelse}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                      <Clock className="h-3 w-3" />
                      {tidSiden(a.tidspunkt)}
                    </div>
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerList>
        </div>

        {/* Bilag som trenger oppmerksomhet */}
        <div>
          <SlideIn direction="up" delay={0.1}>
            <div className="mb-4 flex items-center gap-3">
              <h2 className="text-lg font-semibold">Trenger oppmerksomhet</h2>
              <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/30 font-mono text-xs">
                {ubehandledeBilag.length} ubehandlet
              </Badge>
            </div>
          </SlideIn>
          <StaggerList className="space-y-3" staggerDelay={0.06} initialDelay={0.15}>
            {ubehandledeBilag.map((b) => (
              <StaggerItem key={b.bilagsnr}>
                <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/50 px-4 py-3">
                  <Receipt className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{b.beskrivelse}</p>
                    <p className="text-xs text-muted-foreground">
                      {b.leverandor} · {b.dato}
                    </p>
                  </div>
                  <div className="text-sm font-medium shrink-0">
                    {formatNOK(b.belop)}
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerList>
          <SlideIn direction="up" delay={0.3}>
            <p className="mt-3 text-xs text-muted-foreground">
              + 4 flere bilag venter på bokføring.{" "}
              <a href="/dashboard/bilag" className="text-primary underline-offset-4 hover:underline">
                Se alle bilag →
              </a>
            </p>
          </SlideIn>
        </div>
      </div>

      <Separator />

      {/* Månedsoversikt */}
      <div>
        <SlideIn direction="up" delay={0.1}>
          <h2 className="mb-4 text-lg font-semibold">Månedsoversikt 2026</h2>
        </SlideIn>
        <StaggerList className="grid gap-3 sm:grid-cols-3" staggerDelay={0.05} initialDelay={0.15}>
          {[
            { periode: "Januar", inntekter: 410000, kostnader: 298000, bilag: 34 },
            { periode: "Februar", inntekter: 432000, kostnader: 303000, bilag: 29 },
            { periode: "Mars", inntekter: 485000, kostnader: 312400, bilag: 38 },
          ].map((m) => (
            <StaggerItem key={m.periode}>
              <Card className="border-border/50 bg-card/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{m.periode}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Inntekter</span>
                    <span className="text-green-600 font-medium">{formatNOK(m.inntekter)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Kostnader</span>
                    <span className="text-red-500 font-medium">{formatNOK(m.kostnader)}</span>
                  </div>
                  <div className="flex justify-between text-sm border-t border-border/40 pt-1 mt-1">
                    <span className="font-medium">Resultat</span>
                    <span className="font-bold">{formatNOK(m.inntekter - m.kostnader)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{m.bilag} bilag behandlet</p>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </StaggerList>
      </div>
    </div>
  );
}
