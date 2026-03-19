"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Receipt,
  ArrowRight,
  Bot,
  FileCheck2,
  BarChart3,
  Calculator,
  FileBarChart,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { BlurIn, SlideIn } from "@/components/motion";
import { ScrollReveal } from "@/components/motion";
import { StaggerList, StaggerItem } from "@/components/motion";

const features = [
  {
    icon: Bot,
    title: "AI-bokføring",
    description:
      "AI-agenten analyserer bilag automatisk og foreslår riktige posteringer basert på NS 4102 kontoplan.",
  },
  {
    icon: Receipt,
    title: "Bilagshåndtering",
    description:
      "Last opp kvitteringer og fakturaer. AI tolker innholdet og foreslår bokføring i sanntid.",
  },
  {
    icon: Calculator,
    title: "MVA-beregning",
    description:
      "Automatisk håndtering av MVA-koder og periodevise MVA-meldinger i henhold til norsk regelverk.",
  },
  {
    icon: BarChart3,
    title: "Rapporter",
    description:
      "Resultatregnskap, balanse og MVA-rapport genereres automatisk. Eksporter til SAF-T med ett klikk.",
  },
  {
    icon: FileBarChart,
    title: "SAF-T-eksport",
    description:
      "Eksporter regnskapsdata i SAF-T-format for myndighetskrav og revisjonsformål.",
  },
  {
    icon: ShieldCheck,
    title: "Revisjonsklar",
    description:
      "Komplett sporbarhet fra bilag til balanse. Alle endringer logges med tidsstempel.",
  },
];

const extraFeatures = [
  "Automatisk periodeavslutning",
  "Klientportal for regnskapsbyråer",
  "E-postintegrasjon for fakturainnhenting",
  "Bankkontoavstemming",
  "Prosjektregnskap og kostnadssted",
  "Budsjett vs. regnskap",
  "API for integrasjon med ERP",
  "Flerspråklig rapportering",
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            <span className="font-semibold tracking-tight">ketl regnskap</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/pricing">
              <Button variant="ghost" size="sm">
                Priser
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Logg inn
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 py-24 md:py-32">
        <div className="max-w-2xl">
          <SlideIn direction="up" duration={0.5}>
            <Badge variant="outline" className="mb-4 font-mono">
              <Bot className="mr-1.5 h-3 w-3" />
              AI-regnskapsmedarbeider
            </Badge>
          </SlideIn>
          <BlurIn delay={0.1} duration={0.7}>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Din AI-drevne{" "}
              <span className="text-primary">regnskapsmedarbeider</span>
            </h1>
          </BlurIn>
          <SlideIn direction="up" delay={0.25} duration={0.5}>
            <p className="mt-4 text-lg text-muted-foreground">
              ketl regnskap automatiserer bokføring, bilagshåndtering og
              rapportering for norske småbedrifter. Spar tid — la AI gjøre
              regnskapsarbeidet.
            </p>
          </SlideIn>
          <SlideIn direction="up" delay={0.4} duration={0.5}>
            <div className="mt-8 flex gap-3">
              <Link href="/login">
                <Button size="lg">
                  Kom i gang gratis
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button variant="outline" size="lg">
                  Se priser
                </Button>
              </Link>
            </div>
          </SlideIn>
        </div>
      </section>

      {/* Funksjoner */}
      <section className="border-t border-border/40">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <ScrollReveal direction="up">
            <h2 className="mb-2 text-2xl font-semibold tracking-tight">
              Automatiser regnskapet ditt
            </h2>
            <p className="mb-8 text-muted-foreground">
              Fra bilag til balanse — AI håndterer det meste automatisk.
            </p>
          </ScrollReveal>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <ScrollReveal
                key={f.title}
                direction="up"
                delay={i * 0.08}
              >
                <div className="group space-y-2 rounded-xl border border-border/40 p-5 transition-colors hover:border-border hover:bg-accent/30">
                  <f.icon className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-foreground" />
                  <h3 className="font-medium">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {f.description}
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Ekstra funksjoner */}
      <section className="border-t border-border/40">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <ScrollReveal direction="up">
            <h2 className="mb-6 text-2xl font-semibold tracking-tight">
              Alt du trenger for norsk regnskap
            </h2>
          </ScrollReveal>
          <div className="grid gap-3 sm:grid-cols-2">
            {extraFeatures.map((f, i) => (
              <ScrollReveal key={f} direction="up" delay={i * 0.05}>
                <div className="flex items-center gap-3 rounded-lg border border-border/30 px-4 py-3 text-sm text-muted-foreground transition-colors hover:text-foreground">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                  {f}
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/40 bg-accent/20">
        <div className="mx-auto max-w-5xl px-6 py-16 text-center">
          <ScrollReveal direction="up">
            <FileCheck2 className="mx-auto mb-4 h-10 w-10 text-primary" />
            <h2 className="mb-3 text-2xl font-semibold tracking-tight">
              Klar til å spare tid på regnskapet?
            </h2>
            <p className="mb-6 text-muted-foreground">
              Kom i gang gratis og opplev AI-drevet bokføring fra dag én.
            </p>
            <Link href="/login">
              <Button size="lg">
                Start gratis prøveperiode
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </ScrollReveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Receipt className="h-4 w-4" />
            <span>ketl regnskap</span>
          </div>
          <p className="font-mono text-xs text-muted-foreground">2026</p>
        </div>
      </footer>
    </div>
  );
}
