"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Cloud,
  Zap,
  Database,
  Shield,
  ArrowRight,
  CreditCard,
  Bot,
  ToggleRight,
  Users,
} from "lucide-react";
import { BlurIn, SlideIn } from "@/components/motion";
import { ScrollReveal } from "@/components/motion";
import { StaggerList, StaggerItem } from "@/components/motion";

const features = [
  {
    icon: Zap,
    title: "Serverless backend",
    description:
      "Cloud Functions med automatisk skalering og null vedlikehold.",
  },
  {
    icon: Database,
    title: "Sanntidsdatabase",
    description:
      "Firestore med sanntidssynkronisering og offline-støtte.",
  },
  {
    icon: Shield,
    title: "Autentisering",
    description:
      "Firebase Auth med Google, e-post, passwordless og anonym.",
  },
  {
    icon: CreditCard,
    title: "Stripe-betaling",
    description:
      "Checkout, kundeportal og webhooks for abonnement — ferdig integrert.",
  },
  {
    icon: Bot,
    title: "AI-assistent",
    description:
      "Popup chat med Gemini streaming — kontekstbevisst og tilpassbar.",
  },
  {
    icon: ToggleRight,
    title: "Feature flags",
    description:
      "Sanntids feature-toggles med plan-basert tilgang via Firestore.",
  },
];

const extraFeatures = [
  "Admin-panel med brukeradministrasjon",
  "Onboarding-stepper for nye brukere",
  "API-nøkler for programmatisk tilgang",
  "SEO, Open Graph og JSON-LD",
  "PWA-manifest og Web Vitals",
  "Tema (lys/mørk/system)",
  "CI/CD med GitHub Actions",
  "Samtykkebanner for analytics",
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            <span className="font-semibold tracking-tight">ketl cloud</span>
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
              <Cloud className="mr-1.5 h-3 w-3" />
              SaaS boilerplate
            </Badge>
          </SlideIn>
          <BlurIn delay={0.1} duration={0.7}>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Bygg raskere med{" "}
              <span className="text-primary">ketl cloud</span>
            </h1>
          </BlurIn>
          <SlideIn direction="up" delay={0.25} duration={0.5}>
            <p className="mt-4 text-lg text-muted-foreground">
              Alt du trenger for å lage en moderne SaaS-applikasjon. Firebase,
              Next.js og TypeScript — ferdig konfigurert og klar til bruk.
            </p>
          </SlideIn>
          <SlideIn direction="up" delay={0.4} duration={0.5}>
            <div className="mt-8 flex gap-3">
              <Link href="/login">
                <Button size="lg">
                  Kom i gang
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <a
                href="https://github.com/andreas-t-hjertaker/sandbox"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="lg">
                  GitHub
                </Button>
              </a>
            </div>
          </SlideIn>
        </div>
      </section>

      {/* Funksjoner */}
      <section className="border-t border-border/40">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <ScrollReveal direction="up">
            <h2 className="mb-8 text-2xl font-semibold tracking-tight">
              Alt inkludert
            </h2>
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
              Og mye mer
            </h2>
          </ScrollReveal>
          <div className="grid gap-3 sm:grid-cols-2">
            {extraFeatures.map((f, i) => (
              <ScrollReveal key={f} direction="up" delay={i * 0.05}>
                <div className="flex items-center gap-3 rounded-lg border border-border/30 px-4 py-3 text-sm text-muted-foreground transition-colors hover:text-foreground">
                  <Users className="h-4 w-4 shrink-0" />
                  {f}
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Cloud className="h-4 w-4" />
            <span>ketl cloud</span>
          </div>
          <p className="font-mono text-xs text-muted-foreground">2026</p>
        </div>
      </footer>
    </div>
  );
}
