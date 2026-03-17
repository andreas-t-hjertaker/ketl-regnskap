"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Cloud,
  Database,
  HardDrive,
  Activity,
  Cpu,
  BarChart3,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";

type ServiceStatus = "checking" | "ok" | "error";

type ServiceInfo = {
  name: string;
  description: string;
  icon: React.ElementType;
  status: ServiceStatus;
  detail?: string;
};

export default function Home() {
  const [services, setServices] = useState<ServiceInfo[]>([
    {
      name: "Firebase Hosting",
      description: "Statisk hosting med CDN",
      icon: Cloud,
      status: "ok",
      detail: "ketlcloud.web.app",
    },
    {
      name: "Firestore",
      description: "NoSQL database med sanntidssynk",
      icon: Database,
      status: "checking",
    },
    {
      name: "Cloud Storage",
      description: "Filopplasting og -lagring",
      icon: HardDrive,
      status: "checking",
    },
    {
      name: "Cloud Functions",
      description: "Serverless backend (Node.js 22)",
      icon: Activity,
      status: "checking",
    },
    {
      name: "AI Logic",
      description: "Gemini generativ AI",
      icon: Cpu,
      status: "checking",
    },
    {
      name: "Analytics",
      description: "Page views + custom events",
      icon: BarChart3,
      status: "checking",
    },
  ]);

  function updateService(name: string, status: ServiceStatus, detail?: string) {
    setServices((prev) =>
      prev.map((s) => (s.name === name ? { ...s, status, detail } : s))
    );
  }

  useEffect(() => {
    // Hosting — allerede bekreftet ved å nå denne siden
    // (status er satt til "ok" fra start)

    // Firestore
    async function checkFirestore() {
      try {
        const { onSnapshot, collection } = await import("firebase/firestore");
        const { db } = await import("@/lib/firebase/firestore");
        const unsub = onSnapshot(
          collection(db, "notes"),
          (snap) => {
            updateService("Firestore", "ok", `${snap.size} dokumenter i notes`);
            unsub();
          },
          () => updateService("Firestore", "error", "Kunne ikke koble til")
        );
      } catch {
        updateService("Firestore", "error", "SDK-feil");
      }
    }

    // Storage
    async function checkStorage() {
      try {
        const { ref, getDownloadURL } = await import("firebase/storage");
        const { storage } = await import("@/lib/firebase/storage");
        // Prøv å nå bucketen — en 404 betyr at den finnes men filen mangler
        try {
          await getDownloadURL(ref(storage, "__healthcheck__"));
          updateService("Cloud Storage", "ok", "gs://ketlcloud.firebasestorage.app");
        } catch (e: unknown) {
          const err = e as { code?: string };
          if (err.code === "storage/object-not-found") {
            updateService("Cloud Storage", "ok", "gs://ketlcloud.firebasestorage.app");
          } else {
            updateService("Cloud Storage", "error", err.code || "Ukjent feil");
          }
        }
      } catch {
        updateService("Cloud Storage", "error", "SDK-feil");
      }
    }

    // Functions
    async function checkFunctions() {
      try {
        const res = await fetch(
          "https://health-238849700424.europe-west1.run.app"
        );
        const data = await res.json();
        if (data.status === "ok") {
          updateService("Cloud Functions", "ok", "europe-west1");
        } else {
          updateService("Cloud Functions", "error", "Uventet respons");
        }
      } catch {
        updateService("Cloud Functions", "error", "Ikke tilgjengelig");
      }
    }

    // AI Logic
    async function checkAI() {
      try {
        const { getModel } = await import("@/lib/firebase/ai");
        const model = getModel();
        if (model) {
          updateService("AI Logic", "ok", "gemini-2.0-flash");
        }
      } catch {
        updateService("AI Logic", "error", "Ikke konfigurert");
      }
    }

    // Analytics
    async function checkAnalytics() {
      try {
        const { getAnalyticsInstance } = await import(
          "@/lib/firebase/analytics"
        );
        const instance = await getAnalyticsInstance();
        if (instance) {
          updateService("Analytics", "ok", "G-36LXN3WEM8");
        } else {
          updateService("Analytics", "error", "Ikke støttet i denne nettleseren");
        }
      } catch {
        updateService("Analytics", "error", "SDK-feil");
      }
    }

    checkFirestore();
    checkStorage();
    checkFunctions();
    checkAI();
    checkAnalytics();
  }, []);

  const allOk = services.every((s) => s.status === "ok");
  const checking = services.some((s) => s.status === "checking");

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
            <a
              href="https://github.com/andreas-t-hjertaker/sandbox"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="ghost" size="sm">
                GitHub
              </Button>
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 py-16 md:py-24">
        <div className="max-w-2xl">
          <Badge variant="outline" className="mb-4 font-mono">
            {checking ? (
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
            ) : allOk ? (
              <CheckCircle2 className="mr-1.5 h-3 w-3 text-green-500" />
            ) : (
              <XCircle className="mr-1.5 h-3 w-3 text-red-500" />
            )}
            {checking
              ? "Sjekker tjenester..."
              : allOk
                ? "Alle tjenester operative"
                : "Noen tjenester har problemer"}
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            ketl cloud
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">
            AI-drevet mikrotjenesteorkestrering. Sanntidsstatus for alle
            Firebase-tjenester.
          </p>
        </div>
      </section>

      <Separator className="mx-auto max-w-5xl" />

      {/* Services */}
      <section className="mx-auto max-w-5xl px-6 py-12">
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Tjenester
        </h2>
        <p className="mb-8 text-2xl font-semibold tracking-tight">
          Live status
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <Card key={s.name} className="border-border/50 bg-card/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <s.icon className="h-5 w-5 text-muted-foreground" />
                  <StatusIndicator status={s.status} />
                </div>
                <CardTitle className="text-base">{s.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm">
                  {s.description}
                </CardDescription>
                {s.detail && (
                  <p className="mt-2 font-mono text-xs text-muted-foreground">
                    {s.detail}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator className="mx-auto max-w-5xl" />

      {/* API */}
      <section className="mx-auto max-w-5xl px-6 py-12">
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          API
        </h2>
        <p className="mb-6 text-2xl font-semibold tracking-tight">
          Endepunkter
        </p>
        <div className="space-y-3">
          <Endpoint
            method="GET"
            path="/health"
            url="https://health-238849700424.europe-west1.run.app"
            description="Helsestatus for backend"
          />
          <Endpoint
            method="GET"
            path="/api"
            url="https://api-238849700424.europe-west1.run.app"
            description="API-rotendepunkt"
          />
          <Endpoint
            method="GET"
            path="/api/collections"
            url="https://api-238849700424.europe-west1.run.app/collections"
            description="List alle Firestore-collections"
          />
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

function StatusIndicator({ status }: { status: ServiceStatus }) {
  if (status === "checking") {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  }
  if (status === "ok") {
    return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  }
  return <XCircle className="h-4 w-4 text-red-500" />;
}

function Endpoint({
  method,
  path,
  url,
  description,
}: {
  method: string;
  path: string;
  url: string;
  description: string;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-4 rounded-lg border border-border/50 bg-card/50 px-4 py-3 transition-colors hover:bg-accent/50"
    >
      <Badge variant="secondary" className="font-mono text-xs">
        {method}
      </Badge>
      <code className="text-sm">{path}</code>
      <span className="ml-auto text-xs text-muted-foreground">
        {description}
      </span>
    </a>
  );
}
