"use client";

/**
 * Varsel-banner — viser tidssensitive påminnelser i dashbordet.
 *
 * Varsler:
 * 1. Ubehandlede bilag (vent ikke til fristen!)
 * 2. AI-forslag som venter på godkjenning
 * 3. MVA-melding frister (Skatteetaten — annenhver-månedlige terminer)
 *
 * Ingen nettverkskall — beregnes fra Firestore-data og nåværende dato.
 */

import Link from "next/link";
import { AlertCircle, Bot, CalendarClock, X } from "lucide-react";
import { useState } from "react";
import type { BilagMedId } from "@/hooks/use-bilag";

// ─── MVA-frister ─────────────────────────────────────────────────────────────

/**
 * Norske MVA-terminer iht. Skatteforvaltningsloven.
 * Innberetning annenhver måned, frist 10. i måneden etter terminens slutt.
 *   Termin 1 (jan-feb)  → frist 10. april
 *   Termin 2 (mar-apr)  → frist 10. juni
 *   Termin 3 (mai-jun)  → frist 10. august
 *   Termin 4 (jul-aug)  → frist 10. oktober
 *   Termin 5 (sep-okt)  → frist 10. desember
 *   Termin 6 (nov-des)  → frist 10. februar (neste år)
 */
type MvaFrist = {
  termin: string;
  fristDato: Date;
  label: string;
};

function nesteMvaFrister(): MvaFrist[] {
  const nå = new Date();
  const år = nå.getFullYear();
  const frister: MvaFrist[] = [
    { termin: "T1", fristDato: new Date(år, 3, 10),     label: "Termin 1 (jan–feb)" },
    { termin: "T2", fristDato: new Date(år, 5, 10),     label: "Termin 2 (mar–apr)" },
    { termin: "T3", fristDato: new Date(år, 7, 10),     label: "Termin 3 (mai–jun)" },
    { termin: "T4", fristDato: new Date(år, 9, 10),     label: "Termin 4 (jul–aug)" },
    { termin: "T5", fristDato: new Date(år, 11, 10),    label: "Termin 5 (sep–okt)" },
    { termin: "T6", fristDato: new Date(år + 1, 1, 10), label: "Termin 6 (nov–des)" },
  ];
  // Returner frister som ikke er passert
  return frister.filter((f) => f.fristDato > nå);
}

function dagerTil(dato: Date): number {
  return Math.ceil((dato.getTime() - Date.now()) / 86_400_000);
}

function formaterDato(dato: Date): string {
  return dato.toLocaleDateString("nb-NO", { day: "numeric", month: "long" });
}

// ─── Varseltyper ─────────────────────────────────────────────────────────────

type Varsel = {
  id: string;
  type: "warning" | "info";
  tittel: string;
  melding: string;
  lenke?: string;
  lenkeTekst?: string;
};

function byggVarsler(bilag: BilagMedId[]): Varsel[] {
  const varsler: Varsel[] = [];

  // 1. Ubehandlede bilag
  const ubehandlet = bilag.filter((b) => b.status === "ubehandlet");
  if (ubehandlet.length > 0) {
    varsler.push({
      id: "ubehandlet",
      type: "warning",
      tittel: `${ubehandlet.length} ubehandlet${ubehandlet.length > 1 ? "e" : ""} bilag`,
      melding: "Bilag som ikke er bokført eller avvist kan blokkere regnskapet.",
      lenke: "/dashboard/bilag",
      lenkeTekst: "Gå til bilag →",
    });
  }

  // 2. AI-forslag som venter
  const foreslått = bilag.filter((b) => b.status === "foreslått");
  if (foreslått.length > 0) {
    varsler.push({
      id: "foreslatt",
      type: "info",
      tittel: `${foreslått.length} AI-forslag venter på godkjenning`,
      melding: "Gjennomgå forslagene og godkjenn eller avvis dem.",
      lenke: "/dashboard/bilag",
      lenkeTekst: "Gjennomgå →",
    });
  }

  // 3. MVA-frister innen 30 dager
  const frister = nesteMvaFrister();
  if (frister.length > 0) {
    const neste = frister[0];
    const dager = dagerTil(neste.fristDato);
    if (dager <= 30) {
      varsler.push({
        id: `mva-${neste.termin}`,
        type: dager <= 7 ? "warning" : "info",
        tittel: `MVA-frist om ${dager} dager`,
        melding: `${neste.label}: frist ${formaterDato(neste.fristDato)}. Kontroller at MVA-rapporten er klar.`,
        lenke: "/dashboard/rapporter",
        lenkeTekst: "MVA-rapport →",
      });
    }
  }

  return varsler;
}

// ─── Varsel-komponent ─────────────────────────────────────────────────────────

function VarselBanner({ varsel, onLukk }: { varsel: Varsel; onLukk: (id: string) => void }) {
  const isWarning = varsel.type === "warning";
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${
        isWarning
          ? "border-amber-500/30 bg-amber-500/5"
          : "border-blue-500/30 bg-blue-500/5"
      }`}
    >
      {varsel.id.startsWith("mva") ? (
        <CalendarClock className={`h-4 w-4 mt-0.5 shrink-0 ${isWarning ? "text-amber-500" : "text-blue-500"}`} />
      ) : varsel.id === "foreslatt" ? (
        <Bot className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
      ) : (
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{varsel.tittel}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{varsel.melding}</p>
        {varsel.lenke && (
          <Link
            href={varsel.lenke}
            className="text-xs font-medium text-primary hover:underline mt-1 inline-block"
          >
            {varsel.lenkeTekst}
          </Link>
        )}
      </div>
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
        onClick={() => onLukk(varsel.id)}
        aria-label="Lukk"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Eksportert komponent ─────────────────────────────────────────────────────

export function Varsler({ bilag }: { bilag: BilagMedId[] }) {
  const [lukkede, setLukkede] = useState<Set<string>>(new Set());

  const alleVarsler = byggVarsler(bilag);
  const synlige = alleVarsler.filter((v) => !lukkede.has(v.id));

  if (synlige.length === 0) return null;

  return (
    <div className="space-y-2">
      {synlige.map((v) => (
        <VarselBanner
          key={v.id}
          varsel={v}
          onLukk={(id) => setLukkede((prev) => new Set([...prev, id]))}
        />
      ))}
    </div>
  );
}
