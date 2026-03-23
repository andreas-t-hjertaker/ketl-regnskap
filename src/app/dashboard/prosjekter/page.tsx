"use client";

/**
 * Prosjektregnskap — koble bilag til prosjekter og se per-prosjekt resultat (#40)
 *
 * Støtter:
 * - CRUD for prosjekter
 * - Budsjettstyring per prosjekt
 * - Resultatberegning basert på bokførte bilag med prosjektId
 * - Prosentvis budsjettforbruk
 */

import { useState } from "react";
import {
  FolderOpen,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  Pause,
  Circle,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SlideIn, StaggerList, StaggerItem } from "@/components/motion";
import { useAuth } from "@/hooks/use-auth";
import { useAktivKlient } from "@/hooks/use-aktiv-klient";
import { useBilag } from "@/hooks/use-bilag";
import {
  useProsjekter,
  beregnProsjektResultater,
  type ProsjektMedId,
} from "@/hooks/use-prosjekter";
import type { Prosjekt } from "@/types";

// ─── Formatering ─────────────────────────────────────────────────────────────

function formatNOK(v: number) {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);
}

// ─── Status-badge ─────────────────────────────────────────────────────────────

const statusInfo: Record<
  Prosjekt["status"],
  { label: string; ikon: React.ElementType; farge: string }
> = {
  aktiv: { label: "Aktiv", ikon: Circle, farge: "text-green-500" },
  avsluttet: { label: "Avsluttet", ikon: CheckCircle2, farge: "text-muted-foreground" },
  "på vent": { label: "På vent", ikon: Pause, farge: "text-orange-500" },
};

// ─── Budsjettprogresjon ───────────────────────────────────────────────────────

function Budsjettbar({ pst }: { pst: number }) {
  const farge =
    pst >= 100 ? "bg-red-500" : pst >= 80 ? "bg-orange-500" : "bg-green-500";
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${farge}`}
        style={{ width: `${Math.min(pst, 100)}%` }}
      />
    </div>
  );
}

// ─── Prosjekt-skjema ──────────────────────────────────────────────────────────

type ProsjektForm = {
  navn: string;
  beskrivelse: string;
  startDato: string;
  sluttDato: string;
  budsjett: string;
  prosjektleder: string;
  status: Prosjekt["status"];
};

const TOM_FORM: ProsjektForm = {
  navn: "",
  beskrivelse: "",
  startDato: "",
  sluttDato: "",
  budsjett: "",
  prosjektleder: "",
  status: "aktiv",
};

function ProsjektSkjema({
  initial,
  onLagre,
  onAvbryt,
}: {
  initial?: ProsjektForm;
  onLagre: (data: ProsjektForm) => void;
  onAvbryt: () => void;
}) {
  const [form, setForm] = useState<ProsjektForm>(initial ?? TOM_FORM);

  function sett<K extends keyof ProsjektForm>(k: K, v: ProsjektForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  return (
    <Card className="border-primary/30 bg-accent/5">
      <CardContent className="pt-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium">Navn *</label>
            <Input
              value={form.navn}
              onChange={(e) => sett("navn", e.target.value)}
              placeholder="Prosjektnavn"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Prosjektleder</label>
            <Input
              value={form.prosjektleder}
              onChange={(e) => sett("prosjektleder", e.target.value)}
              placeholder="Navn"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Startdato</label>
            <Input
              type="date"
              value={form.startDato}
              onChange={(e) => sett("startDato", e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Sluttdato</label>
            <Input
              type="date"
              value={form.sluttDato}
              onChange={(e) => sett("sluttDato", e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Budsjett (NOK)</label>
            <Input
              type="number"
              value={form.budsjett}
              onChange={(e) => sett("budsjett", e.target.value)}
              placeholder="0"
              className="h-8 text-sm font-mono"
              min={0}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Status</label>
            <select
              value={form.status}
              onChange={(e) => sett("status", e.target.value as Prosjekt["status"])}
              className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm"
            >
              <option value="aktiv">Aktiv</option>
              <option value="på vent">På vent</option>
              <option value="avsluttet">Avsluttet</option>
            </select>
          </div>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs font-medium">Beskrivelse</label>
          <Input
            value={form.beskrivelse}
            onChange={(e) => sett("beskrivelse", e.target.value)}
            placeholder="Kort prosjektbeskrivelse"
            className="h-8 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => form.navn.trim() && onLagre(form)}
            disabled={!form.navn.trim()}
          >
            Lagre prosjekt
          </Button>
          <Button variant="ghost" size="sm" onClick={onAvbryt}>
            Avbryt
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Hoved-side ───────────────────────────────────────────────────────────────

export default function ProsjekterPage() {
  const { user } = useAuth();
  const { aktivKlientId, aktivKlient } = useAktivKlient();
  const { bilag } = useBilag(user?.uid ?? null, aktivKlientId);
  const { prosjekter, loading, addProsjekt, updateProsjekt, deleteProsjekt } =
    useProsjekter(user?.uid ?? null, aktivKlientId);

  const [visNytt, setVisNytt] = useState(false);
  const [redigerer, setRedigerer] = useState<string | null>(null);

  const resultater = beregnProsjektResultater(prosjekter, bilag);

  async function handleLagre(form: ProsjektForm) {
    if (!aktivKlientId) return;
    await addProsjekt({
      navn: form.navn.trim(),
      beskrivelse: form.beskrivelse || undefined,
      klientId: aktivKlientId,
      startDato: form.startDato || undefined,
      sluttDato: form.sluttDato || undefined,
      budsjett: form.budsjett ? Number(form.budsjett) : undefined,
      prosjektleder: form.prosjektleder || undefined,
      status: form.status,
    });
    setVisNytt(false);
  }

  async function handleOppdater(id: string, form: ProsjektForm) {
    await updateProsjekt(id, {
      navn: form.navn.trim(),
      beskrivelse: form.beskrivelse || undefined,
      startDato: form.startDato || undefined,
      sluttDato: form.sluttDato || undefined,
      budsjett: form.budsjett ? Number(form.budsjett) : undefined,
      prosjektleder: form.prosjektleder || undefined,
      status: form.status,
    });
    setRedigerer(null);
  }

  function prosjektTilForm(p: ProsjektMedId): ProsjektForm {
    return {
      navn: p.navn,
      beskrivelse: p.beskrivelse ?? "",
      startDato: p.startDato ?? "",
      sluttDato: p.sluttDato ?? "",
      budsjett: p.budsjett != null ? String(p.budsjett) : "",
      prosjektleder: p.prosjektleder ?? "",
      status: p.status,
    };
  }

  return (
    <div className="space-y-6">
      {/* ── Topptekst ── */}
      <SlideIn>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <FolderOpen className="h-6 w-6 text-primary" />
              Prosjekter
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {aktivKlient ? aktivKlient.navn : "Velg en klient"} · Prosjektregnskap og kostnadssted
            </p>
          </div>
          {aktivKlientId && (
            <Button size="sm" onClick={() => setVisNytt(true)} disabled={visNytt}>
              <Plus className="mr-2 h-4 w-4" />
              Nytt prosjekt
            </Button>
          )}
        </div>
      </SlideIn>

      {/* ── Ingen klient valgt ── */}
      {!aktivKlientId && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Velg en klient</p>
            <p className="text-sm mt-1">Velg en klient i sidepanelet for å se prosjekter.</p>
          </CardContent>
        </Card>
      )}

      {/* ── Nytt prosjekt-skjema ── */}
      {visNytt && (
        <SlideIn>
          <ProsjektSkjema
            onLagre={handleLagre}
            onAvbryt={() => setVisNytt(false)}
          />
        </SlideIn>
      )}

      {/* ── Prosjektliste ── */}
      {aktivKlientId && (
        loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : prosjekter.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <FolderOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Ingen prosjekter ennå</p>
              <p className="text-sm mt-1">Opprett et prosjekt og koble bilag til det.</p>
            </CardContent>
          </Card>
        ) : (
          <StaggerList className="space-y-4" staggerDelay={0.06}>
            {resultater.map(({ prosjekt: p, inntekter, kostnader, resultat, antallBilag, forbrukPst }) => {
              const info = statusInfo[p.status];
              const StatusIkon = info.ikon;
              return (
                <StaggerItem key={p.id}>
                  {redigerer === p.id ? (
                    <ProsjektSkjema
                      initial={prosjektTilForm(p)}
                      onLagre={(form) => handleOppdater(p.id, form)}
                      onAvbryt={() => setRedigerer(null)}
                    />
                  ) : (
                    <Card>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <StatusIkon className={`h-4 w-4 shrink-0 ${info.farge}`} />
                            <CardTitle className="text-base truncate">{p.navn}</CardTitle>
                            <Badge variant="outline" className="text-[10px] shrink-0">
                              {info.label}
                            </Badge>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => setRedigerer(p.id)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={() => deleteProsjekt(p.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        {p.beskrivelse && (
                          <CardDescription className="text-xs mt-0.5 truncate">
                            {p.beskrivelse}
                          </CardDescription>
                        )}
                        {(p.prosjektleder || p.startDato) && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {p.prosjektleder && <>Ansvarlig: {p.prosjektleder}</>}
                            {p.startDato && <> · {p.startDato}{p.sluttDato && ` → ${p.sluttDato}`}</>}
                          </p>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                          <div>
                            <p className="text-[10px] text-muted-foreground">Inntekter</p>
                            <p className="font-mono text-green-600 text-xs">{formatNOK(inntekter)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Kostnader</p>
                            <p className="font-mono text-red-600 text-xs">{formatNOK(kostnader)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Resultat</p>
                            <p className={`font-mono text-xs font-medium flex items-center gap-1 ${resultat >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {resultat >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {formatNOK(resultat)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Bilag</p>
                            <p className="text-xs font-medium">{antallBilag} stk.</p>
                          </div>
                        </div>

                        {p.budsjett && p.budsjett > 0 && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                              <span>Budsjettforbruk</span>
                              <span>
                                {formatNOK(kostnader)} av {formatNOK(p.budsjett)} ({forbrukPst}%)
                              </span>
                            </div>
                            <Budsjettbar pst={forbrukPst} />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </StaggerItem>
              );
            })}
          </StaggerList>
        )
      )}
    </div>
  );
}
