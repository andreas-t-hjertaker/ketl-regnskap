"use client";

/**
 * Manuell bilagsregistrering
 *
 * Lar bruker opprette et bilag manuelt med dobbel bokføring.
 * Validerer at debet = kredit (balansert bilag) iht. Bokfl. § 9.
 * Bilag kan knyttes til en klient og eventuell motpart.
 */

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SlideIn } from "@/components/motion";
import { useAuth } from "@/hooks/use-auth";
import { useBilag } from "@/hooks/use-bilag";
import { useAktivKlient } from "@/hooks/use-aktiv-klient";
import { useMotparter } from "@/hooks/use-motparter";
import { NS4102_KONTOPLAN } from "@/lib/kontoplan";
import type { Postering } from "@/types";

type PosteringRad = {
  id: string;
  kontonr: string;
  kontonavn: string;
  debet: string;
  kredit: string;
  mvaKode: string;
  beskrivelse: string;
};

function nyRad(): PosteringRad {
  return {
    id: crypto.randomUUID(),
    kontonr: "",
    kontonavn: "",
    debet: "",
    kredit: "",
    mvaKode: "",
    beskrivelse: "",
  };
}

function summerKolonne(rader: PosteringRad[], felt: "debet" | "kredit"): number {
  return rader.reduce((s, r) => s + (parseFloat(r[felt]) || 0), 0);
}

function formatNOK(value: number) {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function NyBilagPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { aktivKlientId } = useAktivKlient();
  const { addBilag } = useBilag(user?.uid ?? null);
  const { motparter } = useMotparter(user?.uid ?? null, aktivKlientId ?? null);

  const [dato, setDato] = useState(() => new Date().toISOString().slice(0, 10));
  const [beskrivelse, setBeskrivelse] = useState("");
  const [leverandor, setLeverandor] = useState("");
  const [motpartId, setMotpartId] = useState("");
  const [kategori, setKategori] = useState("");
  const [rader, setRader] = useState<PosteringRad[]>([nyRad(), nyRad()]);
  const [lagrer, setLagrer] = useState(false);
  const [kontoSøk, setKontoSøk] = useState<Record<string, string>>({});
  const [aktivtFelt, setAktivtFelt] = useState<string | null>(null);

  const totalDebet = summerKolonne(rader, "debet");
  const totalKredit = summerKolonne(rader, "kredit");
  const erBalansert = Math.abs(totalDebet - totalKredit) < 0.01;
  const totalBelop = totalDebet; // Bilagets totalbeløp er debet-summen

  // Kontoplan-søk per rad
  function kontoTreff(søk: string) {
    if (!søk || søk.length < 2) return [];
    const q = søk.toLowerCase();
    return NS4102_KONTOPLAN.filter(
      (k) =>
        k.nummer.startsWith(q) ||
        k.navn.toLowerCase().includes(q)
    ).slice(0, 8);
  }

  function oppdaterRad(id: string, felt: keyof PosteringRad, verdi: string) {
    setRader((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const oppdatert = { ...r, [felt]: verdi };
        // Hvis et kontonummer matches i kontoplan, fyll inn kontonavn automatisk
        if (felt === "kontonr") {
          const funnet = NS4102_KONTOPLAN.find((k) => k.nummer === verdi);
          if (funnet) oppdatert.kontonavn = funnet.navn;
        }
        return oppdatert;
      })
    );
  }

  function velgKonto(radId: string, nummer: string, navn: string) {
    setRader((prev) =>
      prev.map((r) =>
        r.id === radId ? { ...r, kontonr: nummer, kontonavn: navn } : r
      )
    );
    setKontoSøk((prev) => ({ ...prev, [radId]: "" }));
    setAktivtFelt(null);
  }

  function leggTilRad() {
    setRader((prev) => [...prev, nyRad()]);
  }

  function fjernRad(id: string) {
    if (rader.length <= 2) return;
    setRader((prev) => prev.filter((r) => r.id !== id));
  }

  const kanLagre = useMemo(() => {
    const harBeskrivelse = beskrivelse.trim().length > 0;
    const harRader = rader.every((r) => r.kontonr && (r.debet || r.kredit));
    return harBeskrivelse && harRader && erBalansert && totalDebet > 0;
  }, [beskrivelse, rader, erBalansert, totalDebet]);

  async function handleLagre(status: "bokført" | "ubehandlet") {
    if (!user?.uid) return;
    setLagrer(true);

    const posteringer: Postering[] = rader
      .filter((r) => r.kontonr)
      .map((r) => ({
        kontonr: r.kontonr,
        kontonavn: r.kontonavn || r.kontonr,
        debet: parseFloat(r.debet) || 0,
        kredit: parseFloat(r.kredit) || 0,
        ...(r.mvaKode ? { mvaKode: r.mvaKode } : {}),
        ...(r.beskrivelse ? { beskrivelse: r.beskrivelse } : {}),
      }));

    const id = await addBilag({
      dato,
      beskrivelse: beskrivelse.trim(),
      belop: totalBelop,
      klientId: aktivKlientId ?? "",
      status,
      posteringer,
      ...(kategori ? { kategori } : {}),
      ...(leverandor ? { leverandor } : {}),
      ...(motpartId ? { motpartId } : {}),
    });

    setLagrer(false);
    if (id) {
      router.push("/dashboard/bilag");
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <SlideIn direction="up" duration={0.4}>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/bilag">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Nytt bilag</h1>
            <p className="text-muted-foreground text-sm">
              Opprett bilag manuelt med dobbel bokføring. Debet og kredit må være like.
            </p>
          </div>
        </div>
      </SlideIn>

      {/* Bilagsdetaljer */}
      <SlideIn direction="up" delay={0.05}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bilagsopplysninger</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="dato">Dato</Label>
              <Input
                id="dato"
                type="date"
                value={dato}
                onChange={(e) => setDato(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="beskrivelse">Beskrivelse *</Label>
              <Input
                id="beskrivelse"
                placeholder="f.eks. Kjøp av kontorrekvisita"
                value={beskrivelse}
                onChange={(e) => setBeskrivelse(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="leverandor">Leverandør / Avsender</Label>
              <Input
                id="leverandor"
                placeholder="f.eks. Clas Ohlson AS"
                value={leverandor}
                onChange={(e) => setLeverandor(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kategori">Kategori</Label>
              <Input
                id="kategori"
                placeholder="f.eks. Kontorkostnader"
                value={kategori}
                onChange={(e) => setKategori(e.target.value)}
              />
            </div>
            {motparter.length > 0 && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="motpart">Motpart (kunde / leverandør)</Label>
                <select
                  id="motpart"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={motpartId}
                  onChange={(e) => setMotpartId(e.target.value)}
                >
                  <option value="">— Ingen motpart —</option>
                  {motparter.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.navn} ({m.type === "kunde" ? "Kunde" : "Leverandør"})
                      {m.orgnr ? ` · ${m.orgnr}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </CardContent>
        </Card>
      </SlideIn>

      {/* Posteringstabell */}
      <SlideIn direction="up" delay={0.1}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base">Posteringer</CardTitle>
              <CardDescription>
                Legg inn debetside og kreditside. Debet = Kredit for et balansert bilag.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={leggTilRad}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Legg til linje
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="pb-2 text-left font-medium text-muted-foreground w-32">Kontonr.</th>
                    <th className="pb-2 pl-2 text-left font-medium text-muted-foreground">Kontonavn</th>
                    <th className="pb-2 pl-2 text-right font-medium text-muted-foreground w-28">Debet</th>
                    <th className="pb-2 pl-2 text-right font-medium text-muted-foreground w-28">Kredit</th>
                    <th className="pb-2 pl-2 text-left font-medium text-muted-foreground w-20">MVA-kode</th>
                    <th className="pb-2 pl-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {rader.map((rad, idx) => {
                    const søkVerdi = kontoSøk[rad.id] ?? rad.kontonr;
                    const treff = aktivtFelt === rad.id ? kontoTreff(søkVerdi) : [];
                    return (
                      <tr key={rad.id} className="border-b border-border/20">
                        <td className="py-2 relative">
                          <Input
                            value={rad.kontonr}
                            placeholder="1900"
                            className="h-8 font-mono text-xs"
                            onChange={(e) => {
                              oppdaterRad(rad.id, "kontonr", e.target.value);
                              setKontoSøk((prev) => ({ ...prev, [rad.id]: e.target.value }));
                              setAktivtFelt(rad.id);
                            }}
                            onFocus={() => {
                              setAktivtFelt(rad.id);
                              setKontoSøk((prev) => ({ ...prev, [rad.id]: rad.kontonr }));
                            }}
                            onBlur={() => setTimeout(() => setAktivtFelt(null), 150)}
                          />
                          {treff.length > 0 && (
                            <div className="absolute z-10 top-full left-0 w-72 mt-1 bg-popover border border-border rounded-md shadow-md overflow-hidden">
                              {treff.map((k) => (
                                <button
                                  key={k.nummer}
                                  type="button"
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent/50 flex items-center gap-2"
                                  onMouseDown={() => velgKonto(rad.id, k.nummer, k.navn)}
                                >
                                  <span className="font-mono text-xs text-muted-foreground w-10 shrink-0">{k.nummer}</span>
                                  <span className="truncate">{k.navn}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="py-2 pl-2">
                          <Input
                            value={rad.kontonavn}
                            placeholder="Kontonavn"
                            className="h-8 text-xs"
                            onChange={(e) => oppdaterRad(rad.id, "kontonavn", e.target.value)}
                          />
                        </td>
                        <td className="py-2 pl-2">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={rad.debet}
                            placeholder="0"
                            className="h-8 text-right font-mono text-xs"
                            onChange={(e) => {
                              oppdaterRad(rad.id, "debet", e.target.value);
                              if (e.target.value) oppdaterRad(rad.id, "kredit", "");
                            }}
                          />
                        </td>
                        <td className="py-2 pl-2">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={rad.kredit}
                            placeholder="0"
                            className="h-8 text-right font-mono text-xs"
                            onChange={(e) => {
                              oppdaterRad(rad.id, "kredit", e.target.value);
                              if (e.target.value) oppdaterRad(rad.id, "debet", "");
                            }}
                          />
                        </td>
                        <td className="py-2 pl-2">
                          <Input
                            value={rad.mvaKode}
                            placeholder="—"
                            className="h-8 font-mono text-xs"
                            onChange={(e) => oppdaterRad(rad.id, "mvaKode", e.target.value)}
                          />
                        </td>
                        <td className="py-2 pl-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => fjernRad(rad.id)}
                            disabled={rader.length <= 2}
                            title={`Fjern linje ${idx + 1}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border font-semibold">
                    <td className="pt-3" colSpan={2}>Sum</td>
                    <td className="pt-3 text-right font-mono">{formatNOK(totalDebet)}</td>
                    <td className="pt-3 text-right font-mono">{formatNOK(totalKredit)}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Balanseindikator */}
            <div className={`mt-4 flex items-center gap-2 rounded-lg p-3 text-sm ${
              totalDebet === 0
                ? "bg-muted/30 text-muted-foreground"
                : erBalansert
                ? "bg-green-500/10 text-green-700 border border-green-500/20"
                : "bg-red-500/10 text-red-700 border border-red-500/20"
            }`}>
              {totalDebet === 0 ? (
                <AlertCircle className="h-4 w-4 shrink-0" />
              ) : erBalansert ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              {totalDebet === 0
                ? "Fyll inn beløp i posteringene."
                : erBalansert
                ? `Bilaget er balansert. Totalt: ${formatNOK(totalDebet)}`
                : `Ikke balansert: debet er ${formatNOK(totalDebet)}, kredit er ${formatNOK(totalKredit)}. Differanse: ${formatNOK(Math.abs(totalDebet - totalKredit))}`
              }
            </div>
          </CardContent>
        </Card>
      </SlideIn>

      {/* Eksempel-mal */}
      <SlideIn direction="up" delay={0.15}>
        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle className="text-sm">Eksempel: Kjøp av kontorrekvisita (inkl. MVA)</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <div className="grid grid-cols-4 gap-2 font-medium mb-2">
              <span>Konto</span><span>Navn</span><span className="text-right">Debet</span><span className="text-right">Kredit</span>
            </div>
            {[
              { konto: "6500", navn: "Kontorkostnader", debet: "800", kredit: "", mva: "1" },
              { konto: "2710", navn: "Inngående MVA 25%", debet: "200", kredit: "", mva: "" },
              { konto: "2400", navn: "Leverandørgjeld", debet: "", kredit: "1 000", mva: "" },
            ].map((r) => (
              <div key={r.konto} className="grid grid-cols-4 gap-2 font-mono">
                <span>{r.konto}</span><span>{r.navn}</span>
                <span className="text-right">{r.debet || "—"}</span>
                <span className="text-right">{r.kredit || "—"}</span>
              </div>
            ))}
            <p className="mt-2 not-italic font-sans">MVA-kode 1 = innenlands kjøp 25%. Debet 1 000 = Kredit 1 000 ✓</p>
          </CardContent>
        </Card>
      </SlideIn>

      {/* Handlingsknapper */}
      <SlideIn direction="up" delay={0.2}>
        <div className="flex justify-between items-center">
          <Link href="/dashboard/bilag">
            <Button variant="ghost">Avbryt</Button>
          </Link>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={!kanLagre || lagrer}
              onClick={() => handleLagre("ubehandlet")}
            >
              Lagre som utkast
            </Button>
            <Button
              disabled={!kanLagre || lagrer}
              onClick={() => handleLagre("bokført")}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {lagrer ? "Bokfører…" : "Bokfør"}
            </Button>
          </div>
        </div>
        {!aktivKlientId && (
          <p className="mt-2 text-xs text-muted-foreground">
            <AlertCircle className="inline h-3 w-3 mr-1" />
            Ingen klient valgt. Bilag vil ikke knyttes til en klient.
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge variant="outline" className="text-xs font-normal">
            Bokfl. § 9 — dobbel bokføring
          </Badge>
          <Badge variant="outline" className="text-xs font-normal">
            NS 4102 kontoplan
          </Badge>
        </div>
      </SlideIn>
    </div>
  );
}
