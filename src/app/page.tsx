"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Cloud, Zap, Database, Shield, ArrowRight } from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "Serverless backend",
    description: "Cloud Functions med automatisk skalering og null vedlikehold.",
  },
  {
    icon: Database,
    title: "Sanntidsdatabase",
    description: "Firestore med sanntidssynkronisering og offline-støtte.",
  },
  {
    icon: Shield,
    title: "Autentisering",
    description: "Firebase Auth med Google, e-post/passord og mer.",
  },
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
            <Badge variant="secondary" className="font-mono text-xs">
              v0.1.0
            </Badge>
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
          <Badge variant="outline" className="mb-4 font-mono">
            <Cloud className="mr-1.5 h-3 w-3" />
            SaaS boilerplate
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Bygg raskere med{" "}
            <span className="text-primary">ketl cloud</span>
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Alt du trenger for å lage en moderne SaaS-applikasjon. Firebase,
            Next.js og TypeScript — ferdig konfigurert og klar til bruk.
          </p>
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
        </div>
      </section>

      {/* Funksjoner */}
      <section className="border-t border-border/40">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="mb-8 text-2xl font-semibold tracking-tight">
            Alt inkludert
          </h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="space-y-2">
                <f.icon className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-medium">{f.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {f.description}
                </p>
              </div>
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
