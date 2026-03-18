"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
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
  Users,
  FileText,
  Zap,
} from "lucide-react";
import { SlideIn, StaggerList, StaggerItem, AnimatedCounter } from "@/components/motion";
import { AnimatedCard } from "@/components/motion";
import { SkeletonShimmer } from "@/components/motion";

type ServiceStatus = "checking" | "ok" | "error";

type ServiceInfo = {
  name: string;
  description: string;
  icon: React.ElementType;
  status: ServiceStatus;
  detail?: string;
};

export default function DashboardPage() {
  const { user } = useAuth();
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

    async function checkStorage() {
      try {
        const { ref, getDownloadURL } = await import("firebase/storage");
        const { storage } = await import("@/lib/firebase/storage");
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

    async function checkAI() {
      try {
        const { getModel } = await import("@/lib/firebase/ai");
        const model = getModel();
        if (model) {
          updateService("AI Logic", "ok", "gemini-2.5-flash");
        }
      } catch {
        updateService("AI Logic", "error", "Ikke konfigurert");
      }
    }

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

  // Placeholder-statistikk
  const stats = [
    { label: "Brukere", value: 0, icon: Users },
    { label: "Dokumenter", value: 0, icon: FileText },
    { label: "API-kall", value: 0, icon: Zap },
  ];

  return (
    <div className="space-y-8">
      {/* Velkomsthilsen */}
      <SlideIn direction="up" duration={0.4}>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Velkommen{user?.displayName ? `, ${user.displayName}` : ""}
          </h1>
          <p className="text-muted-foreground">
            Her er en oversikt over prosjektet ditt.
          </p>
        </div>
      </SlideIn>

      {/* Hurtigstatistikk */}
      <StaggerList className="grid gap-4 sm:grid-cols-3" staggerDelay={0.08}>
        {stats.map((stat) => (
          <StaggerItem key={stat.label}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardDescription>{stat.label}</CardDescription>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {stat.value === 0 ? (
                  <SkeletonShimmer className="h-8 w-16" />
                ) : (
                  <p className="text-2xl font-bold">
                    <AnimatedCounter value={stat.value} />
                  </p>
                )}
              </CardContent>
            </Card>
          </StaggerItem>
        ))}
      </StaggerList>

      <Separator />

      {/* Tjenestestatus */}
      <div>
        <SlideIn direction="up" delay={0.1}>
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-lg font-semibold">Tjenestestatus</h2>
            <Badge variant="outline" className="font-mono text-xs">
              {checking ? (
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
              ) : allOk ? (
                <CheckCircle2 className="mr-1.5 h-3 w-3 text-green-500" />
              ) : (
                <XCircle className="mr-1.5 h-3 w-3 text-red-500" />
              )}
              {checking
                ? "Sjekker..."
                : allOk
                  ? "Alle operative"
                  : "Problemer oppdaget"}
            </Badge>
          </div>
        </SlideIn>

        <StaggerList
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          staggerDelay={0.06}
          initialDelay={0.15}
        >
          {services.map((s) => (
            <StaggerItem key={s.name}>
              <Card className="border-border/50 bg-card/50">
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
            </StaggerItem>
          ))}
        </StaggerList>
      </div>

      <Separator />

      {/* API-endepunkter */}
      <div>
        <SlideIn direction="up" delay={0.1}>
          <h2 className="mb-4 text-lg font-semibold">API-endepunkter</h2>
        </SlideIn>
        <StaggerList className="space-y-3" staggerDelay={0.05} initialDelay={0.15}>
          <StaggerItem>
            <Endpoint
              method="GET"
              path="/health"
              url="https://health-238849700424.europe-west1.run.app"
              description="Helsestatus for backend"
            />
          </StaggerItem>
          <StaggerItem>
            <Endpoint
              method="GET"
              path="/api"
              url="https://api-238849700424.europe-west1.run.app"
              description="API-rotendepunkt"
            />
          </StaggerItem>
          <StaggerItem>
            <Endpoint
              method="GET"
              path="/api/me"
              url="https://api-238849700424.europe-west1.run.app/me"
              description="Brukerinfo (krever token)"
            />
          </StaggerItem>
          <StaggerItem>
            <Endpoint
              method="GET"
              path="/api/notes"
              url="https://api-238849700424.europe-west1.run.app/notes"
              description="Hent notater (krever token)"
            />
          </StaggerItem>
          <StaggerItem>
            <Endpoint
              method="POST"
              path="/api/notes"
              url="https://api-238849700424.europe-west1.run.app/notes"
              description="Opprett notat (krever token)"
            />
          </StaggerItem>
        </StaggerList>
      </div>
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
      className="flex items-center gap-4 rounded-lg border border-border/50 bg-card/50 px-4 py-3 transition-all hover:bg-accent/50 hover:shadow-sm active:scale-[0.99]"
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
