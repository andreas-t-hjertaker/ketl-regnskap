"use client";

/**
 * Kontoplan — NS 4102 standard norsk kontoplan
 *
 * Viser fullstendig kontoplan med søk og filtrering per kontoklasse.
 * NS 4102 er den norske standarden for kontoplan, som brukes i SAF-T-eksport.
 * Kontoene er inndelt i 8 klasser (1-8) etter norsk standard.
 */

import { useState, useMemo } from "react";
import { Search, BookOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SlideIn } from "@/components/motion";
import { NS4102_KONTOPLAN } from "@/lib/kontoplan";

const KLASSE_BESKRIVELSE: Record<string, { navn: string; farge: string }> = {
  "1": { navn: "Eiendeler", farge: "bg-blue-500/10 text-blue-700 border-blue-500/20" },
  "2": { navn: "Egenkapital og gjeld", farge: "bg-purple-500/10 text-purple-700 border-purple-500/20" },
  "3": { navn: "Driftsinntekter", farge: "bg-green-500/10 text-green-700 border-green-500/20" },
  "4": { navn: "Varekostnad", farge: "bg-orange-500/10 text-orange-700 border-orange-500/20" },
  "5": { navn: "Lønnskostnader", farge: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20" },
  "6": { navn: "Andre driftskostnader", farge: "bg-red-500/10 text-red-700 border-red-500/20" },
  "7": { navn: "Andre driftskostnader (forts.)", farge: "bg-red-500/10 text-red-700 border-red-500/20" },
  "8": { navn: "Finansinntekter og -kostnader", farge: "bg-gray-500/10 text-gray-700 border-gray-500/20" },
};

export default function KontoplanPage() {
  const [søk, setSøk] = useState("");
  const [aktivKlasse, setAktivKlasse] = useState<string | null>(null);

  const filtrerte = useMemo(() => {
    const q = søk.toLowerCase().trim();
    return NS4102_KONTOPLAN.filter((k) => {
      if (aktivKlasse && k.nummer[0] !== aktivKlasse) return false;
      if (!q) return true;
      return (
        k.nummer.startsWith(q) ||
        k.navn.toLowerCase().includes(q) ||
        k.gruppe.toLowerCase().includes(q)
      );
    });
  }, [søk, aktivKlasse]);

  // Grupper filtrerte kontoer etter gruppe
  const grupper = useMemo(() => {
    const map = new Map<string, typeof NS4102_KONTOPLAN>();
    for (const k of filtrerte) {
      const liste = map.get(k.gruppe) ?? [];
      liste.push(k);
      map.set(k.gruppe, liste);
    }
    return map;
  }, [filtrerte]);

  const klasser = [...new Set(NS4102_KONTOPLAN.map((k) => k.nummer[0]))].sort();

  return (
    <div className="space-y-6">
      <SlideIn direction="up" duration={0.4}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Kontoplan</h1>
            <p className="text-muted-foreground">
              NS 4102 standard norsk kontoplan — brukt i SAF-T-eksport og bokføring.
            </p>
          </div>
          <Badge variant="outline" className="font-mono">
            {NS4102_KONTOPLAN.length} kontoer
          </Badge>
        </div>
      </SlideIn>

      {/* Søk og filtrer */}
      <SlideIn direction="up" delay={0.05}>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Søk etter kontonr. eller kontonavn…"
              className="pl-9"
              value={søk}
              onChange={(e) => setSøk(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant={aktivKlasse === null ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => setAktivKlasse(null)}
            >
              Alle klasser
            </Button>
            {klasser.map((k) => (
              <Button
                key={k}
                size="sm"
                variant={aktivKlasse === k ? "default" : "outline"}
                className="h-7 text-xs"
                onClick={() => setAktivKlasse(aktivKlasse === k ? null : k)}
              >
                Klasse {k}
                <span className="ml-1 text-muted-foreground hidden sm:inline">
                  — {KLASSE_BESKRIVELSE[k]?.navn}
                </span>
              </Button>
            ))}
          </div>
        </div>
      </SlideIn>

      {/* Ingen treff */}
      {filtrerte.length === 0 && (
        <SlideIn direction="up">
          <div className="rounded-xl border border-border/40 py-16 text-center text-muted-foreground">
            <BookOpen className="mx-auto mb-3 h-8 w-8 opacity-40" />
            <p className="text-sm font-medium">Ingen kontoer funnet</p>
            <p className="text-xs mt-1">Prøv et annet søkeord eller kontonummer.</p>
          </div>
        </SlideIn>
      )}

      {/* Kontoer gruppert */}
      {[...grupper.entries()].map(([gruppe, kontoer], i) => (
        <SlideIn key={gruppe} direction="up" delay={i * 0.04}>
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold">{gruppe}</CardTitle>
                <Badge
                  variant="outline"
                  className={`text-xs font-normal ${KLASSE_BESKRIVELSE[kontoer[0]?.nummer[0] ?? "1"]?.farge ?? ""}`}
                >
                  Klasse {kontoer[0]?.nummer[0]}
                </Badge>
                <Badge variant="outline" className="text-xs font-normal ml-auto">
                  {kontoer.length} kontoer
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <tbody>
                  {kontoer.map((k, ki) => (
                    <tr
                      key={k.nummer}
                      className={`${ki < kontoer.length - 1 ? "border-b border-border/20" : ""} hover:bg-accent/30 transition-colors`}
                    >
                      <td className="px-4 py-2.5 font-mono text-sm font-semibold text-muted-foreground w-16">
                        {k.nummer}
                      </td>
                      <td className="px-2 py-2.5 flex-1">{k.navn}</td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {k.mvaKode && (
                            <Badge variant="outline" className="font-mono text-xs py-0">
                              MVA {k.mvaKode}
                            </Badge>
                          )}
                          <Badge
                            variant="outline"
                            className={`text-xs py-0 ${
                              k.type === "inntekt" ? "text-green-600" :
                              k.type === "kostnad" ? "text-red-600" :
                              k.type === "eiendel" ? "text-blue-600" :
                              k.type === "gjeld" ? "text-purple-600" :
                              "text-muted-foreground"
                            }`}
                          >
                            {k.type}
                          </Badge>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </SlideIn>
      ))}

      {/* NS 4102 info */}
      <SlideIn direction="up" delay={0.1}>
        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle className="text-sm">Om NS 4102</CardTitle>
            <CardDescription>
              Norsk Standard 4102 — standard kontoplan for norske virksomheter
            </CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2">
            <p>
              NS 4102 definerer en ensartet kontoplan for norsk næringsliv og er grunnlaget for
              SAF-T Financial-eksport (Skatteetatens standard). Kontoene er delt inn i 8 klasser:
            </p>
            <div className="grid gap-1 sm:grid-cols-2">
              {Object.entries(KLASSE_BESKRIVELSE).map(([k, { navn, farge }]) => (
                <div key={k} className={`flex items-center gap-2 rounded px-2 py-1 border ${farge}`}>
                  <span className="font-mono font-bold">{k}</span>
                  <span>{navn}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </SlideIn>
    </div>
  );
}
