"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Webhook,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { SlideIn } from "@/components/motion";
import { useWebhooks, type WebhookLoggItem } from "@/hooks/use-webhooks";
import { showToast } from "@/lib/toast";
import { formatDate } from "@/lib/utils";
import type { WebhookHendelse } from "@/types";

const ALLE_HENDELSER: { hendelse: WebhookHendelse; beskrivelse: string }[] = [
  { hendelse: "bilag.opprettet",  beskrivelse: "Nytt bilag opprettet" },
  { hendelse: "bilag.oppdatert",  beskrivelse: "Bilag oppdatert" },
  { hendelse: "bilag.bokfort",    beskrivelse: "Bilag bokført" },
  { hendelse: "bilag.avvist",     beskrivelse: "Bilag avvist" },
  { hendelse: "bilag.kreditert",  beskrivelse: "Bilag kreditert" },
  { hendelse: "klient.opprettet", beskrivelse: "Ny klient opprettet" },
  { hendelse: "klient.oppdatert", beskrivelse: "Klient oppdatert" },
];

export default function WebhooksPage() {
  const { webhooks, loading, createWebhook, deleteWebhook, fetchLogg } = useWebhooks();

  const [visSkjema, setVisSkjema] = useState(false);
  const [url, setUrl] = useState("");
  const [valgte, setValgte] = useState<Set<WebhookHendelse>>(new Set());
  const [lagrer, setLagrer] = useState(false);

  const [åpenLogg, setÅpenLogg] = useState<string | null>(null);
  const [loggData, setLoggData] = useState<WebhookLoggItem[]>([]);
  const [lasterLogg, setLasterLogg] = useState(false);

  function toggleHendelse(h: WebhookHendelse) {
    setValgte((prev) => {
      const neste = new Set(prev);
      if (neste.has(h)) neste.delete(h);
      else neste.add(h);
      return neste;
    });
  }

  async function handleOpprett() {
    if (!url || valgte.size === 0) {
      showToast("error", "Fyll inn URL og velg minst én hendelse.");
      return;
    }
    try { new URL(url); } catch {
      showToast("error", "Ugyldig URL.");
      return;
    }
    setLagrer(true);
    const ok = await createWebhook(url, [...valgte]);
    setLagrer(false);
    if (ok) {
      showToast("success", "Webhook opprettet.");
      setUrl("");
      setValgte(new Set());
      setVisSkjema(false);
    } else {
      showToast("error", "Kunne ikke opprette webhook.");
    }
  }

  async function handleSlett(id: string) {
    if (!confirm("Slett denne webhook-konfigurasjonen?")) return;
    const ok = await deleteWebhook(id);
    if (ok) showToast("success", "Webhook slettet.");
    else showToast("error", "Kunne ikke slette webhook.");
  }

  async function toggleLogg(id: string) {
    if (åpenLogg === id) {
      setÅpenLogg(null);
      return;
    }
    setÅpenLogg(id);
    setLasterLogg(true);
    const data = await fetchLogg(id);
    setLoggData(data);
    setLasterLogg(false);
  }

  return (
    <div className="space-y-6">
      <SlideIn direction="up" duration={0.4}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/utvikler">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Webhooks</h1>
              <p className="text-muted-foreground text-sm">
                Motta sanntidsvarslinger til din tjeneste ved hendelser i ketl regnskap.
              </p>
            </div>
          </div>
          <Button onClick={() => setVisSkjema((v) => !v)}>
            <Plus className="mr-2 h-4 w-4" />
            Ny webhook
          </Button>
        </div>
      </SlideIn>

      {/* Opprett-skjema */}
      {visSkjema && (
        <SlideIn direction="up" delay={0.05}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Registrer ny webhook</CardTitle>
              <CardDescription>
                Ketl vil sende en HTTP POST med JSON-payload til din URL ved valgte hendelser.
                Payloaden er signert med HMAC-SHA256 (header: <code className="font-mono text-xs">X-Ketl-Signature</code>).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="webhook-url">Endpoint URL</Label>
                <Input
                  id="webhook-url"
                  placeholder="https://din-tjeneste.no/ketl-hook"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Hendelser å abonnere på</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {ALLE_HENDELSER.map(({ hendelse, beskrivelse }) => (
                    <label
                      key={hendelse}
                      className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2 cursor-pointer hover:bg-accent/40 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={valgte.has(hendelse)}
                        onChange={() => toggleHendelse(hendelse)}
                        className="accent-primary"
                      />
                      <div className="min-w-0">
                        <p className="font-mono text-xs">{hendelse}</p>
                        <p className="text-xs text-muted-foreground">{beskrivelse}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setVisSkjema(false)}>Avbryt</Button>
                <Button onClick={handleOpprett} disabled={lagrer}>
                  {lagrer ? <Spinner className="h-4 w-4" /> : "Opprett webhook"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </SlideIn>
      )}

      {/* Webhook-liste */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-6 w-6" />
        </div>
      ) : webhooks.length === 0 ? (
        <SlideIn direction="up">
          <div className="rounded-xl border border-border/40 py-16 text-center text-muted-foreground">
            <Webhook className="mx-auto mb-3 h-8 w-8 opacity-40" />
            <p className="text-sm font-medium">Ingen webhooks konfigurert</p>
            <p className="text-xs mt-1">Opprett en webhook for å motta sanntidsvarslinger.</p>
          </div>
        </SlideIn>
      ) : (
        <div className="space-y-3">
          {webhooks.map((wh, i) => (
            <SlideIn key={wh.id} direction="up" delay={i * 0.04}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={wh.aktiv ? "default" : "secondary"}>
                          {wh.aktiv ? "Aktiv" : "Inaktiv"}
                        </Badge>
                        <span className="font-mono text-sm truncate">{wh.url}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {wh.hendelser.map((h) => (
                          <Badge key={h} variant="outline" className="font-mono text-xs">
                            {h}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Opprettet {formatDate(wh.opprettet)}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleLogg(wh.id)}
                        className="text-xs"
                      >
                        <Clock className="mr-1 h-3.5 w-3.5" />
                        Logg
                        {åpenLogg === wh.id ? (
                          <ChevronUp className="ml-1 h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="ml-1 h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleSlett(wh.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Leveringslogg */}
                  {åpenLogg === wh.id && (
                    <div className="mt-4 border-t border-border/40 pt-4">
                      {lasterLogg ? (
                        <div className="flex justify-center py-4">
                          <Spinner className="h-4 w-4" />
                        </div>
                      ) : loggData.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">
                          Ingen leveringer registrert ennå.
                        </p>
                      ) : (
                        <div className="space-y-1">
                          {loggData.map((logg) => (
                            <div
                              key={logg.id}
                              className="flex items-center justify-between text-xs py-1.5 border-b border-border/20 last:border-0"
                            >
                              <div className="flex items-center gap-2">
                                {logg.ok ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                                ) : (
                                  <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                                )}
                                <span className="font-mono">{logg.hendelse}</span>
                              </div>
                              <div className="flex items-center gap-3 text-muted-foreground">
                                <span>HTTP {logg.statusKode}</span>
                                <span>{logg.forsøk} forsøk</span>
                                <span>{formatDate(logg.tidspunkt)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </SlideIn>
          ))}
        </div>
      )}

      {/* Dokumentasjon */}
      <SlideIn direction="up" delay={0.1}>
        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle className="text-sm">Payload-format og signering</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Alle webhook-kall sendes som HTTP POST med <code className="font-mono text-xs bg-muted px-1 rounded">Content-Type: application/json</code>.
              Payloaden inneholder:
            </p>
            <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto">{`{
  "hendelse": "bilag.bokfort",
  "tidspunkt": "2026-03-20T10:00:00.000Z",
  "userId": "uid123",
  "webhookId": "wh_abc",
  "data": { /* hendelsesdata */ }
}`}</pre>
            <p>
              Bekreft ektheten ved å validere signaturen i headeren{" "}
              <code className="font-mono text-xs bg-muted px-1 rounded">X-Ketl-Signature</code>.
              Den er HMAC-SHA256 av payload-strengen med din hemmelighet som nøkkel.
            </p>
            <pre className="bg-muted rounded-md p-3 text-xs overflow-x-auto">{`// Node.js-eksempel
const crypto = require('crypto');
const forventet = crypto
  .createHmac('sha256', DIN_HEMMELIGHET)
  .update(rawBody)
  .digest('hex');
const ok = forventet === req.headers['x-ketl-signature'];`}</pre>
          </CardContent>
        </Card>
      </SlideIn>
    </div>
  );
}
