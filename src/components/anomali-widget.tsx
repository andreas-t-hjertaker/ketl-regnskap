"use client";

/**
 * Anomali-widget (#38)
 *
 * Viser flaggede bilag fra anomalideteksjonen på dashboard og rapporter-siden.
 */

import { useState } from "react";
import {
  AlertTriangle,
  Copy,
  TrendingUp,
  Calendar,
  Circle,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SlideIn } from "@/components/motion";
import type { Anomali, AnomalType } from "@/hooks/use-anomalideteksjon";

const typeInfo: Record<AnomalType, { label: string; ikon: React.ElementType }> = {
  duplikat: { label: "Duplikat", ikon: Copy },
  statistisk_avvik: { label: "Statistisk avvik", ikon: TrendingUp },
  helg_bokforing: { label: "Helg-bokføring", ikon: Calendar },
  rundt_tall: { label: "Rundt tall", ikon: Circle },
  negativt_belop: { label: "Negativt beløp", ikon: AlertTriangle },
  mva_differanse: { label: "MVA-differanse", ikon: AlertTriangle },
};

const alvorfarge: Record<Anomali["alvorlighet"], string> = {
  høy: "border-red-500/30 bg-red-500/5",
  middels: "border-orange-500/30 bg-orange-500/5",
  lav: "border-yellow-500/30 bg-yellow-500/5",
};

const alvorbadge: Record<Anomali["alvorlighet"], string> = {
  høy: "border-red-500 text-red-600",
  middels: "border-orange-500 text-orange-600",
  lav: "border-yellow-500 text-yellow-600",
};

function AnomalRad({ a, onClick }: { a: Anomali; onClick?: (id: string) => void }) {
  const info = typeInfo[a.type];
  const Ikon = info.ikon;
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${alvorfarge[a.alvorlighet]}`}>
      <div className="flex items-start gap-2">
        <Ikon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium">Bilag #{a.bilagsnr}</span>
            <Badge variant="outline" className={`text-[10px] px-1.5 h-4 ${alvorbadge[a.alvorlighet]}`}>
              {a.alvorlighet}
            </Badge>
            <Badge variant="outline" className="text-[10px] px-1.5 h-4">
              {info.label}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{a.beskrivelse}</p>
        </div>
        {onClick && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs shrink-0"
            onClick={() => onClick(a.bilagId)}
          >
            Se bilag
          </Button>
        )}
      </div>
    </div>
  );
}

export function AnomaliWidget({
  anomalier,
  onBilagKlikk,
  maksVis = 5,
}: {
  anomalier: Anomali[];
  onBilagKlikk?: (id: string) => void;
  maksVis?: number;
}) {
  const [åpen, setÅpen] = useState(false);
  const [visAlle, setVisAlle] = useState(false);

  if (anomalier.length === 0) {
    return (
      <SlideIn>
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="py-4 flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-green-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-700 dark:text-green-400">
                Ingen anomalier oppdaget
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Alle bokførte bilag ser normale ut.
              </p>
            </div>
          </CardContent>
        </Card>
      </SlideIn>
    );
  }

  const høye = anomalier.filter((a) => a.alvorlighet === "høy").length;
  const midlere = anomalier.filter((a) => a.alvorlighet === "middels").length;
  const viste = visAlle ? anomalier : anomalier.slice(0, maksVis);

  return (
    <SlideIn>
      <Card className={høye > 0 ? "border-red-500/30" : "border-orange-500/30"}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className={`h-4 w-4 ${høye > 0 ? "text-red-500" : "text-orange-500"}`} />
              <CardTitle className="text-sm">
                {anomalier.length} anomali{anomalier.length !== 1 ? "er" : ""} oppdaget
              </CardTitle>
              {høye > 0 && (
                <Badge variant="outline" className="border-red-500 text-red-600 text-[10px] px-1.5 h-4">
                  {høye} høy
                </Badge>
              )}
              {midlere > 0 && (
                <Badge variant="outline" className="border-orange-500 text-orange-600 text-[10px] px-1.5 h-4">
                  {midlere} middels
                </Badge>
              )}
            </div>
            <button
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              onClick={() => setÅpen((p) => !p)}
            >
              {åpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {åpen ? "Skjul" : "Vis"}
            </button>
          </div>
          <CardDescription className="text-xs">
            Statistisk analyse av {anomalier.length} flaggede bilag. Gjennomgå og bekreft eller korriger.
          </CardDescription>
        </CardHeader>

        {åpen && (
          <CardContent className="space-y-2 pt-0">
            {viste.map((a) => (
              <AnomalRad key={a.bilagId} a={a} onClick={onBilagKlikk} />
            ))}
            {!visAlle && anomalier.length > maksVis && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-7 text-xs text-muted-foreground"
                onClick={() => setVisAlle(true)}
              >
                Vis alle {anomalier.length} anomalier
              </Button>
            )}
          </CardContent>
        )}
      </Card>
    </SlideIn>
  );
}
