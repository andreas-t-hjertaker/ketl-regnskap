"use client";

/**
 * CSV-import av bilag (#122)
 *
 * Brukeren kan laste opp en CSV-fil (fra bank, Excel el. andre systemer)
 * og importere bilag direkte til Firestore.
 *
 * Steg:
 * 1. Last opp CSV-fil (eller lim inn tekst)
 * 2. Forhåndsvis parsede rader og kartlegg kolonner
 * 3. Velg rader som skal importeres
 * 4. Importer — alle bilag opprettes med status "ubehandlet"
 */

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Upload,
  FileDown,
  CheckSquare,
  Square,
  AlertTriangle,
  CheckCircle2,
  X,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SlideIn } from "@/components/motion";
import { useAuth } from "@/hooks/use-auth";
import { useAktivKlient } from "@/hooks/use-aktiv-klient";
import { useBilag } from "@/hooks/use-bilag";
import { showToast } from "@/lib/toast";

// ─── CSV-parsing ──────────────────────────────────────────────────────────────

function gjessSeparator(tekst: string): string {
  const første = tekst.split("\n")[0] ?? "";
  const antallSemi = (første.match(/;/g) ?? []).length;
  const antallKomma = (første.match(/,/g) ?? []).length;
  const antallTab = (første.match(/\t/g) ?? []).length;
  if (antallTab >= antallSemi && antallTab >= antallKomma) return "\t";
  if (antallSemi >= antallKomma) return ";";
  return ",";
}

function parseCSV(tekst: string): { headers: string[]; rader: string[][] } {
  const separator = gjessSeparator(tekst);
  const linjer = tekst
    .split("\n")
    .map((l) => l.replace(/\r$/, "").trim())
    .filter((l) => l.length > 0);

  if (linjer.length < 2) return { headers: [], rader: [] };

  const parseLinje = (linje: string): string[] => {
    const felt: string[] = [];
    let i = 0;
    while (i < linje.length) {
      if (linje[i] === '"') {
        let j = i + 1;
        while (j < linje.length) {
          if (linje[j] === '"' && linje[j + 1] === '"') {
            j += 2;
          } else if (linje[j] === '"') {
            break;
          } else {
            j++;
          }
        }
        felt.push(linje.slice(i + 1, j).replace(/""/g, '"'));
        i = j + 2; // skip closing quote + separator
      } else {
        const slutt = linje.indexOf(separator, i);
        if (slutt === -1) {
          felt.push(linje.slice(i));
          break;
        }
        felt.push(linje.slice(i, slutt));
        i = slutt + 1;
      }
    }
    return felt;
  };

  const headers = parseLinje(linjer[0]);
  const rader = linjer.slice(1).map(parseLinje);
  return { headers, rader };
}

/** Prøv å parse et norsk beløp (1 234,50 → 1234.50) */
function parseNorskBeløp(s: string): number | null {
  const cleaned = s
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

/** Validér og normaliser dato til ISO (YYYY-MM-DD) */
function normaliserDato(s: string): string | null {
  // Prøv DD.MM.YYYY
  const dm = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dm) return `${dm[3]}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`;
  // Prøv YYYY-MM-DD
  const iso = s.match(/^\d{4}-\d{2}-\d{2}$/);
  if (iso) return s;
  // Prøv DD/MM/YYYY
  const sl = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (sl) return `${sl[3]}-${sl[2].padStart(2, "0")}-${sl[1].padStart(2, "0")}`;
  return null;
}

// ─── Typer ────────────────────────────────────────────────────────────────────

type BilagFelt = "dato" | "beskrivelse" | "belop" | "leverandor" | "kategori" | "(ignorér)";

const FELT_LABELS: Record<BilagFelt, string> = {
  dato: "Dato",
  beskrivelse: "Beskrivelse",
  belop: "Beløp",
  leverandor: "Leverandør",
  kategori: "Kategori",
  "(ignorér)": "(ignorér)",
};

type ParsetRad = {
  originalRad: string[];
  dato: string | null;
  beskrivelse: string;
  belop: number | null;
  leverandor: string;
  kategori: string;
  valideringsfeil: string[];
};

// ─── Steg-komponent ───────────────────────────────────────────────────────────

type Steg = "last-opp" | "kartlegg" | "forhåndsvis" | "ferdig";

export default function BilagImportPage() {
  const { user } = useAuth();
  const { aktivKlientId } = useAktivKlient();
  const { addBilag } = useBilag(user?.uid ?? null, aktivKlientId);

  const [steg, setSteg] = useState<Steg>("last-opp");
  const [csvTekst, setCsvTekst] = useState("");
  const [parsed, setParsed] = useState<{ headers: string[]; rader: string[][] }>({ headers: [], rader: [] });
  const [kartlegging, setKartlegging] = useState<Record<number, BilagFelt>>({});
  const [parseteRader, setParseteRader] = useState<ParsetRad[]>([]);
  const [valgte, setValgte] = useState<Set<number>>(new Set());
  const [importerer, setImporterer] = useState(false);
  const [importertAntall, setImportertAntall] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFil = useCallback(async (fil: File) => {
    const tekst = await fil.text();
    setCsvTekst(tekst);
    const result = parseCSV(tekst);
    setParsed(result);

    // Auto-gjett kolonnemapping basert på header-navn
    const autoMap: Record<number, BilagFelt> = {};
    result.headers.forEach((h, i) => {
      const lower = h.toLowerCase().trim();
      if (lower.includes("dato") || lower.includes("date")) autoMap[i] = "dato";
      else if (lower.includes("beskriv") || lower.includes("tekst") || lower.includes("descr") || lower.includes("trans")) autoMap[i] = "beskrivelse";
      else if (lower.includes("beløp") || lower.includes("belop") || lower.includes("amount") || lower.includes("sum") || lower.includes("kroner")) autoMap[i] = "belop";
      else if (lower.includes("leverandør") || lower.includes("leverandor") || lower.includes("vendor") || lower.includes("motpart")) autoMap[i] = "leverandor";
      else if (lower.includes("kategori") || lower.includes("konto") || lower.includes("category")) autoMap[i] = "kategori";
      else autoMap[i] = "(ignorér)";
    });
    setKartlegging(autoMap);
    setSteg("kartlegg");
  }, []);

  const gjørKartlegging = useCallback(() => {
    const datoKol = Object.entries(kartlegging).find(([, v]) => v === "dato")?.[0];
    const beskrivelseKol = Object.entries(kartlegging).find(([, v]) => v === "beskrivelse")?.[0];
    const belopKol = Object.entries(kartlegging).find(([, v]) => v === "belop")?.[0];
    const leverandorKol = Object.entries(kartlegging).find(([, v]) => v === "leverandor")?.[0];
    const kategoriKol = Object.entries(kartlegging).find(([, v]) => v === "kategori")?.[0];

    const rader = parsed.rader.map((rad): ParsetRad => {
      const feil: string[] = [];
      const datoRå = datoKol !== undefined ? (rad[parseInt(datoKol)] ?? "").trim() : "";
      const belopRå = belopKol !== undefined ? (rad[parseInt(belopKol)] ?? "").trim() : "";

      const dato = datoRå ? normaliserDato(datoRå) : null;
      const belop = belopRå ? parseNorskBeløp(belopRå) : null;
      const beskrivelse = beskrivelseKol !== undefined ? (rad[parseInt(beskrivelseKol)] ?? "").trim() : "";

      if (!dato) feil.push("Ugyldig eller manglende dato");
      if (belop === null) feil.push("Ugyldig eller manglende beløp");
      if (!beskrivelse) feil.push("Manglende beskrivelse");

      return {
        originalRad: rad,
        dato,
        beskrivelse,
        belop,
        leverandor: leverandorKol !== undefined ? (rad[parseInt(leverandorKol)] ?? "").trim() : "",
        kategori: kategoriKol !== undefined ? (rad[parseInt(kategoriKol)] ?? "").trim() : "",
        valideringsfeil: feil,
      };
    });

    setParseteRader(rader);
    // Forhåndsvelg alle gyldige rader
    const gyldige = new Set(
      rader
        .map((r, i) => (r.valideringsfeil.length === 0 ? i : -1))
        .filter((i) => i >= 0)
    );
    setValgte(gyldige);
    setSteg("forhåndsvis");
  }, [parsed, kartlegging]);

  const importerValgte = useCallback(async () => {
    if (!user?.uid || !aktivKlientId) {
      showToast.error("Ingen aktiv klient valgt.");
      return;
    }
    setImporterer(true);
    let antall = 0;
    for (const i of valgte) {
      const rad = parseteRader[i];
      if (!rad || rad.valideringsfeil.length > 0) continue;
      await addBilag({
        dato: rad.dato!,
        beskrivelse: rad.beskrivelse,
        belop: Math.abs(rad.belop!),
        leverandor: rad.leverandor || undefined,
        kategori: rad.kategori || undefined,
        klientId: aktivKlientId,
        status: "ubehandlet",
        posteringer: [],
      });
      antall++;
    }
    setImportertAntall(antall);
    setImporterer(false);
    setSteg("ferdig");
  }, [valgte, parseteRader, addBilag, user, aktivKlientId]);

  function tilbakestill() {
    setSteg("last-opp");
    setCsvTekst("");
    setParsed({ headers: [], rader: [] });
    setKartlegging({});
    setParseteRader([]);
    setValgte(new Set());
    setImportertAntall(0);
  }

  return (
    <div className="space-y-6">
      <SlideIn direction="up" duration={0.4}>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/bilag">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <FileDown className="h-6 w-6" />
              CSV-import av bilag
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Importer bilag fra bank, Excel eller andre regnskapssystemer.
            </p>
          </div>
        </div>
      </SlideIn>

      {/* Steg 1: Last opp */}
      {steg === "last-opp" && (
        <SlideIn direction="up" delay={0.1}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Steg 1 av 3 — Last opp CSV-fil</CardTitle>
              <CardDescription>
                Støttede formater: CSV, TSV med semikolon, komma eller tab. Første rad må være kolonneoverskrifter.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Dra-og-slipp */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer rounded-xl border-2 border-dashed border-border/50 px-6 py-10 text-center hover:border-primary/40 hover:bg-accent/10 transition-colors"
              >
                <Upload className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium">Klikk for å velge CSV-fil</p>
                <p className="text-xs text-muted-foreground mt-1">
                  .csv, .tsv, .txt — maks 5 MB
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,.txt"
                className="hidden"
                onChange={(e) => {
                  const fil = e.target.files?.[0];
                  if (fil) handleFil(fil);
                  e.target.value = "";
                }}
              />

              {/* Lim inn tekst */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Eller lim inn CSV-tekst:</p>
                <textarea
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs font-mono outline-none focus:ring-1 focus:ring-ring h-32 resize-y"
                  placeholder={`Dato;Beskrivelse;Beløp;Leverandør\n2026-01-15;Kontorrekvisita;1250,00;Staples\n2026-01-20;Internett;499,00;Telenor`}
                  value={csvTekst}
                  onChange={(e) => setCsvTekst(e.target.value)}
                />
                <Button
                  size="sm"
                  onClick={() => {
                    const result = parseCSV(csvTekst);
                    setParsed(result);
                    const autoMap: Record<number, BilagFelt> = {};
                    result.headers.forEach((h, i) => {
                      const lower = h.toLowerCase().trim();
                      if (lower.includes("dato")) autoMap[i] = "dato";
                      else if (lower.includes("beskriv") || lower.includes("tekst")) autoMap[i] = "beskrivelse";
                      else if (lower.includes("beløp") || lower.includes("belop") || lower.includes("sum")) autoMap[i] = "belop";
                      else if (lower.includes("leverandør") || lower.includes("leverandor")) autoMap[i] = "leverandor";
                      else if (lower.includes("kategori")) autoMap[i] = "kategori";
                      else autoMap[i] = "(ignorér)";
                    });
                    setKartlegging(autoMap);
                    setSteg("kartlegg");
                  }}
                  disabled={csvTekst.trim().length === 0}
                >
                  Fortsett
                </Button>
              </div>

              {/* Eksempel-format */}
              <div className="rounded-lg bg-muted/30 p-3 text-xs font-mono text-muted-foreground">
                <p className="font-sans text-xs font-medium mb-1 text-foreground">Eksempel CSV-format:</p>
                <p>Dato;Beskrivelse;Beløp;Leverandør</p>
                <p>2026-01-15;Kontorrekvisita;1250,00;Staples</p>
                <p>2026-01-20;Internett;499,00;Telenor</p>
              </div>
            </CardContent>
          </Card>
        </SlideIn>
      )}

      {/* Steg 2: Kartlegg kolonner */}
      {steg === "kartlegg" && (
        <SlideIn direction="up" delay={0.1}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Steg 2 av 3 — Kartlegg kolonner</CardTitle>
              <CardDescription>
                {parsed.rader.length} rader funnet. Tilordne CSV-kolonner til bilag-felt.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">CSV-kolonne</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Eksempelverdi</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Bilag-felt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.headers.map((header, i) => (
                      <tr key={i} className="border-b border-border/30">
                        <td className="px-3 py-2 font-mono text-xs">{header}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground font-mono">
                          {parsed.rader[0]?.[i] ?? "—"}
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={kartlegging[i] ?? "(ignorér)"}
                            onChange={(e) =>
                              setKartlegging((prev) => ({
                                ...prev,
                                [i]: e.target.value as BilagFelt,
                              }))
                            }
                            className="rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
                          >
                            {(Object.keys(FELT_LABELS) as BilagFelt[]).map((f) => (
                              <option key={f} value={f}>{FELT_LABELS[f]}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setSteg("last-opp")}>
                  Tilbake
                </Button>
                <Button
                  size="sm"
                  onClick={gjørKartlegging}
                  disabled={
                    !Object.values(kartlegging).includes("dato") ||
                    !Object.values(kartlegging).includes("beskrivelse") ||
                    !Object.values(kartlegging).includes("belop")
                  }
                >
                  Forhåndsvis ({parsed.rader.length} rader)
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Dato, Beskrivelse og Beløp er påkrevde felt.
              </p>
            </CardContent>
          </Card>
        </SlideIn>
      )}

      {/* Steg 3: Forhåndsvis og importer */}
      {steg === "forhåndsvis" && (
        <SlideIn direction="up" delay={0.1}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Steg 3 av 3 — Forhåndsvis og importer</span>
                <Badge variant="secondary">{valgte.size} valgt</Badge>
              </CardTitle>
              <CardDescription>
                {parseteRader.filter((r) => r.valideringsfeil.length === 0).length} av {parseteRader.length} rader er gyldige.
                Velg radene du vil importere.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Velg/fjern alle */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setValgte(
                      new Set(
                        parseteRader
                          .map((r, i) => (r.valideringsfeil.length === 0 ? i : -1))
                          .filter((i) => i >= 0)
                      )
                    )
                  }
                >
                  <CheckSquare className="mr-2 h-3.5 w-3.5" />
                  Velg alle gyldige
                </Button>
                <Button variant="outline" size="sm" onClick={() => setValgte(new Set())}>
                  <Square className="mr-2 h-3.5 w-3.5" />
                  Fjern alle
                </Button>
              </div>

              {/* Radliste */}
              <div className="max-h-96 overflow-y-auto space-y-1.5 pr-1">
                {parseteRader.map((rad, i) => {
                  const erValgt = valgte.has(i);
                  const harFeil = rad.valideringsfeil.length > 0;
                  return (
                    <div
                      key={i}
                      onClick={() => {
                        if (harFeil) return;
                        setValgte((prev) => {
                          const ny = new Set(prev);
                          if (ny.has(i)) ny.delete(i);
                          else ny.add(i);
                          return ny;
                        });
                      }}
                      className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                        harFeil
                          ? "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 cursor-not-allowed opacity-70"
                          : erValgt
                          ? "border-primary/30 bg-primary/5 cursor-pointer"
                          : "border-border/40 hover:bg-muted/20 cursor-pointer"
                      }`}
                    >
                      <div className="mt-0.5">
                        {harFeil ? (
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                        ) : erValgt ? (
                          <CheckSquare className="h-4 w-4 text-primary" />
                        ) : (
                          <Square className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-xs font-mono">{rad.dato ?? "?"}</span>
                          <span className="text-xs">{rad.beskrivelse || "—"}</span>
                          {rad.leverandor && (
                            <span className="text-xs text-muted-foreground">{rad.leverandor}</span>
                          )}
                          {rad.belop !== null && (
                            <span className="text-xs font-mono ml-auto">
                              {new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", minimumFractionDigits: 0 }).format(Math.abs(rad.belop))}
                            </span>
                          )}
                        </div>
                        {harFeil && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                            {rad.valideringsfeil.join(" · ")}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setSteg("kartlegg")}>
                  Tilbake
                </Button>
                <Button
                  size="sm"
                  onClick={importerValgte}
                  disabled={valgte.size === 0 || importerer}
                >
                  {importerer ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Importerer…
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Importer {valgte.size} bilag
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </SlideIn>
      )}

      {/* Ferdig */}
      {steg === "ferdig" && (
        <SlideIn direction="up" delay={0.1}>
          <Card>
            <CardContent className="py-12 text-center space-y-4">
              <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
              <div>
                <p className="text-lg font-bold">{importertAntall} bilag importert</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Alle bilag er opprettet med status «ubehandlet».
                  AI vil analysere og foreslå bokføring automatisk.
                </p>
              </div>
              <div className="flex justify-center gap-3">
                <Link href="/dashboard/bilag">
                  <Button variant="outline">Gå til bilaglisten</Button>
                </Link>
                <Button onClick={tilbakestill}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Importer ny fil
                </Button>
              </div>
            </CardContent>
          </Card>
        </SlideIn>
      )}
    </div>
  );
}
