"use client";

/**
 * Agent-forklarbarhet — visuell forklaring av AI-valg (#100)
 *
 * Viser en detaljert, menneskelesbar forklaring av hvorfor AI-agenten
 * valgte den aktuelle konteringen. Inkluderer:
 * - Konfidens-indikator med fargekode
 * - Dokument-signaler agenten identifiserte
 * - Begrunnelse for hvert kontovalg
 * - Regelreferanser (bokføringslov, MVA-lov)
 * - Lignende historiske bilag
 * - Usikkerhetsområder
 */

import { useState } from "react";
import {
  Brain,
  ChevronDown,
  ChevronRight,
  FileSearch,
  BookOpen,
  History,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AiForslag } from "@/types";

// ─── Konfidens-visualisering ────────────────────────────────────────────────

function KonfidensBar({ konfidens }: { konfidens: number }) {
  const pst = Math.round(konfidens * 100);
  const farge =
    pst >= 85
      ? "bg-green-500"
      : pst >= 70
      ? "bg-yellow-500"
      : pst >= 50
      ? "bg-orange-500"
      : "bg-red-500";

  const tekstFarge =
    pst >= 85
      ? "text-green-600"
      : pst >= 70
      ? "text-yellow-600"
      : pst >= 50
      ? "text-orange-600"
      : "text-red-600";

  const label =
    pst >= 85
      ? "Høy tillit"
      : pst >= 70
      ? "Middels tillit"
      : pst >= 50
      ? "Lav tillit"
      : "Svært usikker";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className={`font-medium ${tekstFarge}`}>
          {label} — {pst}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${farge}`}
          style={{ width: `${pst}%` }}
        />
      </div>
    </div>
  );
}

// ─── Forklarings-seksjon ────────────────────────────────────────────────────

function Seksjon({
  ikon: Ikon,
  tittel,
  children,
  startÅpen = false,
}: {
  ikon: React.ElementType;
  tittel: string;
  children: React.ReactNode;
  startÅpen?: boolean;
}) {
  const [åpen, setÅpen] = useState(startÅpen);

  return (
    <div className="border-l-2 border-primary/20 pl-3">
      <button
        className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground w-full text-left py-1"
        onClick={() => setÅpen((p) => !p)}
      >
        {åpen ? (
          <ChevronDown className="h-3 w-3 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 flex-shrink-0" />
        )}
        <Ikon className="h-3.5 w-3.5 flex-shrink-0" />
        {tittel}
      </button>
      {åpen && <div className="mt-1.5 space-y-1.5">{children}</div>}
    </div>
  );
}

// ─── Hovedkomponent ─────────────────────────────────────────────────────────

export function AiForklaring({ forslag }: { forslag: AiForslag }) {
  const forklaring = forslag.forklaring;

  return (
    <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Brain className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Agentens resonnement</span>
      </div>

      {/* Konfidensbar */}
      <KonfidensBar konfidens={forslag.konfidens} />

      {/* Kort begrunnelse */}
      <p className="text-xs text-muted-foreground leading-relaxed">
        {forslag.begrunnelse}
      </p>

      {/* Detaljert forklaring (om tilgjengelig) */}
      {forklaring && (
        <div className="space-y-2 pt-1">
          {/* Dokument-signaler */}
          {forklaring.dokumentSignaler.length > 0 && (
            <Seksjon ikon={FileSearch} tittel="Hva agenten identifiserte" startÅpen>
              <ul className="space-y-1">
                {forklaring.dokumentSignaler.map((signal, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <span className="text-primary mt-0.5">·</span>
                    {signal}
                  </li>
                ))}
              </ul>
            </Seksjon>
          )}

          {/* Kontovalg-begrunnelser */}
          {forklaring.kontoValg.length > 0 && (
            <Seksjon ikon={Lightbulb} tittel="Hvorfor disse kontoene" startÅpen>
              <div className="space-y-1.5">
                {forklaring.kontoValg.map((valg, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <Badge variant="outline" className="font-mono text-[10px] px-1.5 shrink-0">
                      {valg.kontonr}
                    </Badge>
                    <span className="text-muted-foreground">{valg.grunn}</span>
                  </div>
                ))}
              </div>
            </Seksjon>
          )}

          {/* Regelreferanser */}
          {forklaring.regelreferanser && forklaring.regelreferanser.length > 0 && (
            <Seksjon ikon={BookOpen} tittel="Regelgrunnlag">
              <ul className="space-y-1">
                {forklaring.regelreferanser.map((ref, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="text-blue-500 mt-0.5">§</span>
                    {ref}
                  </li>
                ))}
              </ul>
            </Seksjon>
          )}

          {/* Lignende bilag */}
          {forklaring.lignendeBilag && forklaring.lignendeBilag.length > 0 && (
            <Seksjon ikon={History} tittel={`Lignende bilag (${forklaring.lignendeBilag.length})`}>
              <div className="space-y-1">
                {forklaring.lignendeBilag.map((lb, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground truncate">
                      #{lb.bilagsnr} — {lb.beskrivelse}
                    </span>
                    <Badge variant="outline" className="text-[10px] ml-2 shrink-0">
                      {Math.round(lb.likhet * 100)}% likhet
                    </Badge>
                  </div>
                ))}
              </div>
            </Seksjon>
          )}

          {/* Usikkerhet */}
          {forklaring.usikkerhet && forklaring.usikkerhet.length > 0 && (
            <Seksjon ikon={AlertTriangle} tittel="Usikkerhetsområder">
              <ul className="space-y-1">
                {forklaring.usikkerhet.map((u, i) => (
                  <li key={i} className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
                    <span className="mt-0.5">⚠</span>
                    {u}
                  </li>
                ))}
              </ul>
            </Seksjon>
          )}
        </div>
      )}

      {/* Fallback om ingen detaljert forklaring */}
      {!forklaring && (
        <p className="text-[10px] text-muted-foreground italic pt-1">
          Detaljert resonnering vil bli tilgjengelig når AI-agenten oppgraderes til neste versjon.
        </p>
      )}
    </div>
  );
}
