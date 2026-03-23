"use client";

/**
 * Kontoplan — NS 4102 standard norsk kontoplan med bruker-tilpasning
 *
 * Viser fullstendig kontoplan med søk og filtrering per kontoklasse.
 * Brukere kan deaktivere kontoer de ikke bruker, og legge til egendefinerte kontoer
 * som ikke finnes i NS 4102-standarden.
 *
 * Tilpassede kontoer lagres i users/{uid}/kontoplan/{nummer} i Firestore.
 */

import { useState, useMemo } from "react";
import { Search, BookOpen, Plus, X, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SlideIn } from "@/components/motion";
import { useAuth } from "@/hooks/use-auth";
import { useKontoplan, type KontoMedStatus } from "@/hooks/use-kontoplan";
import type { Konto } from "@/types";

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

const KONTO_TYPER: Konto["type"][] = [
  "eiendel", "gjeld", "egenkapital", "inntekt", "kostnad",
];

function NyKontoSkjema({
  onLagret,
  onAvbryt,
  addCustomKonto,
}: {
  onLagret: () => void;
  onAvbryt: () => void;
  addCustomKonto: (data: {
    nummer: string;
    navn: string;
    gruppe: string;
    type: Konto["type"];
  }) => Promise<boolean>;
}) {
  const [nummer, setNummer] = useState("");
  const [navn, setNavn] = useState("");
  const [gruppe, setGruppe] = useState("");
  const [type, setType] = useState<Konto["type"]>("kostnad");
  const [lagrer, setLagrer] = useState(false);

  async function handleSubmit(e: { preventDefault: () => void }) {
    e.preventDefault();
    if (!nummer || !navn) return;
    setLagrer(true);
    const ok = await addCustomKonto({ nummer, navn, gruppe: gruppe || "Egendefinerte kontoer", type });
    setLagrer(false);
    if (ok) onLagret();
  }

  return (
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={handleSubmit}>
      <div className="space-y-1.5">
        <Label htmlFor="ny-nummer">Kontonummer *</Label>
        <Input
          id="ny-nummer"
          placeholder="f.eks. 3950"
          value={nummer}
          onChange={(e) => setNummer(e.target.value.replace(/\D/g, ""))}
          maxLength={8}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ny-navn">Kontonavn *</Label>
        <Input
          id="ny-navn"
          placeholder="f.eks. Sponsorinntekter"
          value={navn}
          onChange={(e) => setNavn(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ny-gruppe">Gruppe</Label>
        <Input
          id="ny-gruppe"
          placeholder="f.eks. Driftsinntekter"
          value={gruppe}
          onChange={(e) => setGruppe(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ny-type">Type</Label>
        <select
          id="ny-type"
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={type}
          onChange={(e) => setType(e.target.value as Konto["type"])}
        >
          {KONTO_TYPER.map((t) => (
            <option key={t} value={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2 flex gap-2">
        <Button type="submit" disabled={lagrer}>
          {lagrer ? "Lagrer…" : "Legg til konto"}
        </Button>
        <Button type="button" variant="outline" onClick={onAvbryt}>
          Avbryt
        </Button>
      </div>
    </form>
  );
}

export default function KontoplanPage() {
  const { user } = useAuth();
  const { kontoplan, loading, toggleAktiv, addCustomKonto, deleteCustomKonto } =
    useKontoplan(user?.uid ?? null);

  const [søk, setSøk] = useState("");
  const [aktivKlasse, setAktivKlasse] = useState<string | null>(null);
  const [visDeaktivert, setVisDeaktivert] = useState(false);
  const [visNySkjema, setVisNySkjema] = useState(false);
  const [redigerer, setRedigerer] = useState(false);

  const filtrerte = useMemo(() => {
    const q = søk.toLowerCase().trim();
    return kontoplan.filter((k) => {
      if (!visDeaktivert && k.erDeaktivert) return false;
      if (aktivKlasse && k.nummer[0] !== aktivKlasse) return false;
      if (!q) return true;
      return (
        k.nummer.startsWith(q) ||
        k.navn.toLowerCase().includes(q) ||
        k.gruppe.toLowerCase().includes(q)
      );
    });
  }, [kontoplan, søk, aktivKlasse, visDeaktivert]);

  const grupper = useMemo(() => {
    const map = new Map<string, KontoMedStatus[]>();
    for (const k of filtrerte) {
      const liste = map.get(k.gruppe) ?? [];
      liste.push(k);
      map.set(k.gruppe, liste);
    }
    return map;
  }, [filtrerte]);

  const klasser: string[] = [...new Set(kontoplan.map((k: KontoMedStatus) => k.nummer[0]))].sort();
  const antallDeaktivert = kontoplan.filter((k) => k.erDeaktivert).length;
  const antallCustom = kontoplan.filter((k) => k.erCustom).length;

  return (
    <div className="space-y-6">
      <SlideIn direction="up" duration={0.4}>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Kontoplan</h1>
            <p className="text-muted-foreground">
              NS 4102 standard norsk kontoplan — tilpass og administrer dine kontoer.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono">
              {kontoplan.filter((k) => !k.erDeaktivert).length} aktive
            </Badge>
            <Button
              size="sm"
              variant={redigerer ? "default" : "outline"}
              onClick={() => setRedigerer(!redigerer)}
            >
              {redigerer ? "Ferdig" : "Rediger"}
            </Button>
          </div>
        </div>
      </SlideIn>

      {/* Ny konto-skjema */}
      {redigerer && (
        <SlideIn direction="up">
          {visNySkjema ? (
            <Card className="border-primary/30">
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  Legg til egendefinert konto
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setVisNySkjema(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </CardTitle>
                <CardDescription>
                  Legg til kontoer som ikke finnes i NS 4102-standarden.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <NyKontoSkjema
                  onLagret={() => setVisNySkjema(false)}
                  onAvbryt={() => setVisNySkjema(false)}
                  addCustomKonto={addCustomKonto}
                />
              </CardContent>
            </Card>
          ) : (
            <Button onClick={() => setVisNySkjema(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Ny egendefinert konto
            </Button>
          )}
        </SlideIn>
      )}

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
            {antallDeaktivert > 0 && (
              <Button
                size="sm"
                variant={visDeaktivert ? "secondary" : "outline"}
                className="h-7 text-xs ml-auto"
                onClick={() => setVisDeaktivert(!visDeaktivert)}
              >
                {visDeaktivert ? "Skjul" : "Vis"} deaktivert ({antallDeaktivert})
              </Button>
            )}
          </div>
        </div>
      </SlideIn>

      {/* Laste-tilstand */}
      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-20 p-4" />
            </Card>
          ))}
        </div>
      )}

      {/* Ingen treff */}
      {!loading && filtrerte.length === 0 && (
        <SlideIn direction="up">
          <div className="rounded-xl border border-border/40 py-16 text-center text-muted-foreground">
            <BookOpen className="mx-auto mb-3 h-8 w-8 opacity-40" />
            <p className="text-sm font-medium">Ingen kontoer funnet</p>
            <p className="text-xs mt-1">Prøv et annet søkeord eller kontonummer.</p>
          </div>
        </SlideIn>
      )}

      {/* Kontoer gruppert */}
      {!loading &&
        [...grupper.entries()].map(([gruppe, kontoer], i) => (
          <SlideIn key={gruppe} direction="up" delay={i * 0.03}>
            <Card className={kontoer.every((k) => k.erDeaktivert) ? "opacity-50" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-semibold">{gruppe}</CardTitle>
                  <Badge
                    variant="outline"
                    className={`text-xs font-normal ${KLASSE_BESKRIVELSE[kontoer[0]?.nummer[0] ?? "1"]?.farge ?? ""}`}
                  >
                    {kontoer[0]?.erCustom
                      ? "Egendefinert"
                      : `Klasse ${kontoer[0]?.nummer[0]}`}
                  </Badge>
                  <Badge variant="outline" className="text-xs font-normal ml-auto">
                    {kontoer.length} kontoer
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <tbody>
                    {kontoer.map((k: KontoMedStatus, ki: number) => (
                      <tr
                        key={k.nummer}
                        className={`${ki < kontoer.length - 1 ? "border-b border-border/20" : ""} hover:bg-accent/30 transition-colors ${k.erDeaktivert ? "opacity-40" : ""}`}
                      >
                        <td className="px-4 py-2.5 font-mono text-sm font-semibold text-muted-foreground w-16">
                          {k.nummer}
                        </td>
                        <td className="px-2 py-2.5 flex-1">
                          {k.navn}
                          {k.erCustom && (
                            <Badge variant="outline" className="ml-2 text-xs py-0 text-blue-600 border-blue-500/30">
                              egendefinert
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {k.mvaKode && !redigerer && (
                              <Badge variant="outline" className="font-mono text-xs py-0">
                                MVA {k.mvaKode}
                              </Badge>
                            )}
                            {!redigerer && (
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
                            )}
                            {redigerer && (
                              <div className="flex items-center gap-1">
                                {k.erCustom && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive hover:text-destructive"
                                    onClick={() => deleteCustomKonto(k.nummer)}
                                    title="Slett egendefinert konto"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 gap-1.5 text-xs"
                                  onClick={() => toggleAktiv(k.nummer)}
                                  title={k.erDeaktivert ? "Aktiver konto" : "Deaktiver konto"}
                                >
                                  {k.erDeaktivert ? (
                                    <>
                                      <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                                      <span className="text-muted-foreground">Inaktiv</span>
                                    </>
                                  ) : (
                                    <>
                                      <ToggleRight className="h-4 w-4 text-green-600" />
                                      <span>Aktiv</span>
                                    </>
                                  )}
                                </Button>
                              </div>
                            )}
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
            {antallCustom > 0 && (
              <p className="mt-2 text-xs">
                Du har lagt til <strong>{antallCustom}</strong> egendefinert{antallCustom > 1 ? "e" : ""} konto{antallCustom > 1 ? "er" : ""} utover NS 4102-standarden.
              </p>
            )}
          </CardContent>
        </Card>
      </SlideIn>
    </div>
  );
}
