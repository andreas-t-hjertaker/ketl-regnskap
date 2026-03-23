"use client";

/**
 * Fristmonitor — viser lovpålagte regnskapsfrister med dager til/siden frist.
 * Frister beregnes dynamisk basert på dagens dato.
 */

import { useMemo } from "react";
import { CalendarClock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Frist = {
  id: string;
  navn: string;
  dato: Date;
  type: "månedlig" | "bimonthly" | "årlig";
  beskrivelse: string;
};

function neste5IMåneden(fraMåned: Date): Date {
  const d = new Date(fraMåned.getFullYear(), fraMåned.getMonth(), 5);
  if (d <= fraMåned) {
    d.setMonth(d.getMonth() + 1);
  }
  return d;
}

function nesteMvaFrist(fra: Date): Date {
  // MVA betales annenhver måned: termin 1=jan-feb (frist 10.mars), 2=mar-apr (10.mai), osv.
  const terminSluttMåned = [1, 3, 5, 7, 9, 11]; // 0-indexed: feb, apr, jun, aug, okt, des
  const iDag = fra;
  for (const mnd of terminSluttMåned) {
    const frist = new Date(iDag.getFullYear(), mnd + 1, 10); // 10. i neste måned
    if (frist > iDag) return frist;
  }
  return new Date(iDag.getFullYear() + 1, 2, 10); // 10. mars neste år
}

function beregnFrister(iDag: Date): Frist[] {
  const år = iDag.getFullYear();
  const frister: Frist[] = [];

  // A-melding: 5. i hver måned
  for (let offset = -1; offset <= 2; offset++) {
    const mnd = new Date(år, iDag.getMonth() + offset, 5);
    if (Math.abs(mnd.getTime() - iDag.getTime()) < 90 * 86400000) {
      frister.push({
        id: `amelding-${mnd.toISOString().slice(0, 7)}`,
        navn: "A-melding",
        dato: mnd,
        type: "månedlig",
        beskrivelse: `Lønn og arbeidsgiveravgift — ${mnd.toLocaleDateString("nb-NO", { month: "long", year: "numeric" })}`,
      });
    }
  }

  // MVA: annenhver måned
  const mvaMåneder = [
    { termin: "T1 (jan–feb)", frist: new Date(år, 2, 10) },
    { termin: "T2 (mar–apr)", frist: new Date(år, 4, 10) },
    { termin: "T3 (mai–jun)", frist: new Date(år, 6, 10) },
    { termin: "T4 (jul–aug)", frist: new Date(år, 8, 10) },
    { termin: "T5 (sep–okt)", frist: new Date(år, 10, 10) },
    { termin: "T6 (nov–des)", frist: new Date(år + 1, 1, 10) },
  ];
  for (const { termin, frist } of mvaMåneder) {
    if (Math.abs(frist.getTime() - iDag.getTime()) < 90 * 86400000) {
      frister.push({
        id: `mva-${termin}`,
        navn: "MVA-melding",
        dato: frist,
        type: "bimonthly",
        beskrivelse: `Termin ${termin}`,
      });
    }
  }

  // Skattemelding: 31. mai
  const skattemelding = new Date(år, 4, 31);
  if (Math.abs(skattemelding.getTime() - iDag.getTime()) < 120 * 86400000) {
    frister.push({
      id: `skattemelding-${år}`,
      navn: "Skattemelding",
      dato: skattemelding,
      type: "årlig",
      beskrivelse: `Næringsoppgave ${år - 1}`,
    });
  }

  // Årsregnskap: 31. juli
  const årsregnskap = new Date(år, 6, 31);
  if (Math.abs(årsregnskap.getTime() - iDag.getTime()) < 120 * 86400000) {
    frister.push({
      id: `årsregnskap-${år}`,
      navn: "Årsregnskap",
      dato: årsregnskap,
      type: "årlig",
      beskrivelse: `Innsending til Brønnøysund for ${år - 1}`,
    });
  }

  return frister
    .filter((f, i, arr) => arr.findIndex((x) => x.id === f.id) === i) // dedupliser
    .sort((a, b) => a.dato.getTime() - b.dato.getTime())
    .slice(0, 6);
}

export function Fristmonitor() {
  const iDag = useMemo(() => new Date(), []);
  const frister = useMemo(() => beregnFrister(iDag), [iDag]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
          Regnskapsfrister
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {frister.map((frist) => {
          const dager = Math.ceil(
            (frist.dato.getTime() - iDag.getTime()) / 86400000
          );
          const forfalt = dager < 0;
          const snart = dager >= 0 && dager <= 7;

          return (
            <div
              key={frist.id}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${
                forfalt
                  ? "bg-destructive/10 text-destructive"
                  : snart
                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                  : "bg-muted/40 text-foreground"
              }`}
            >
              {forfalt ? (
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              ) : snart ? (
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              )}
              <div className="flex-1 min-w-0">
                <span className="font-medium">{frist.navn}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  {frist.beskrivelse}
                </span>
              </div>
              <Badge
                variant="outline"
                className={`shrink-0 text-xs font-mono ${
                  forfalt
                    ? "border-destructive/50 text-destructive"
                    : snart
                    ? "border-amber-500/50 text-amber-700 dark:text-amber-400"
                    : "text-muted-foreground"
                }`}
              >
                {forfalt
                  ? `${Math.abs(dager)}d over`
                  : dager === 0
                  ? "I dag"
                  : `${dager}d`}
              </Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
