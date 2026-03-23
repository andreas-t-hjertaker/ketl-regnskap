"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet } from "@/lib/api-client";
import { Users, CreditCard, Key, TrendingUp } from "lucide-react";

type AdminStats = {
  totalUsers: number;
  activeSubscriptions: number;
  totalApiKeys: number;
  mrr: number;
};

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<AdminStats>("/admin/stats").then((res) => {
      if (res.success) {
        setStats(res.data);
      }
      setLoading(false);
    });
  }, []);

  const cards = [
    {
      title: "Totalt brukere",
      value: stats?.totalUsers ?? 0,
      icon: Users,
      description: "Registrerte brukere",
    },
    {
      title: "Aktive abonnementer",
      value: stats?.activeSubscriptions ?? 0,
      icon: CreditCard,
      description: "Betalende kunder",
    },
    {
      title: "MRR",
      value: stats
        ? new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 }).format(stats.mrr)
        : "—",
      icon: TrendingUp,
      description: "Månedlig tilbakevendende inntekt",
    },
    {
      title: "API-nøkler",
      value: stats?.totalApiKeys ?? 0,
      icon: Key,
      description: "Utstedte nøkler",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin-oversikt</h1>
        <p className="text-muted-foreground">
          Oversikt over plattformens nøkkeltall.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{card.value}</div>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {card.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
