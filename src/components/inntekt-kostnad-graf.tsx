"use client";

/**
 * Inntekt vs. kostnad per måned — linjegraf for dashboardet.
 * Beregner månedlige summer direkte fra bilag-arrayet.
 */

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import type { BilagMedId } from "@/hooks/use-bilag";

type Props = {
  bilag: BilagMedId[];
};

type MånedData = {
  mnd: string;
  inntekter: number;
  kostnader: number;
};

function norskMåned(yyyy_mm: string): string {
  const [år, mnd] = yyyy_mm.split("-");
  const d = new Date(parseInt(år), parseInt(mnd) - 1, 1);
  return d.toLocaleDateString("nb-NO", { month: "short", year: "2-digit" });
}

function beregnMånedTotaler(bilag: BilagMedId[]): MånedData[] {
  const map = new Map<string, { inntekter: number; kostnader: number }>();

  for (const b of bilag) {
    if (b.status !== "bokført" && b.status !== "kreditert") continue;
    const mnd = b.dato.slice(0, 7);
    if (!map.has(mnd)) map.set(mnd, { inntekter: 0, kostnader: 0 });
    const entry = map.get(mnd)!;
    for (const p of b.posteringer) {
      const klasse = p.kontonr[0];
      if (klasse === "3") entry.inntekter += (p.kredit ?? 0) - (p.debet ?? 0);
      if (klasse >= "4" && klasse <= "8") entry.kostnader += (p.debet ?? 0) - (p.kredit ?? 0);
    }
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12) // Siste 12 måneder
    .map(([mnd, { inntekter, kostnader }]) => ({
      mnd: norskMåned(mnd),
      inntekter: Math.round(Math.abs(inntekter)),
      kostnader: Math.round(Math.abs(kostnader)),
    }));
}

function formatKr(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return `${value}`;
}

export function InntektKostnadGraf({ bilag }: Props) {
  const data = useMemo(() => beregnMånedTotaler(bilag), [bilag]);

  if (data.length < 2) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          Inntekter vs. kostnader
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <XAxis
              dataKey="mnd"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={formatKr}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              formatter={(value) =>
                new Intl.NumberFormat("nb-NO", {
                  style: "currency",
                  currency: "NOK",
                  maximumFractionDigits: 0,
                }).format(Number(value))
              }
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--popover))",
                color: "hsl(var(--popover-foreground))",
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              formatter={(value) =>
                value === "inntekter" ? "Inntekter" : "Kostnader"
              }
            />
            <Line
              type="monotone"
              dataKey="inntekter"
              stroke="hsl(142 71% 45%)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="kostnader"
              stroke="hsl(0 72% 51%)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
