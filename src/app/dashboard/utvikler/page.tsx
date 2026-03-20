"use client";

import { useState } from "react";
import { Code, Plus, Copy, Eye, EyeOff, AlertTriangle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { useApiKeys } from "@/hooks/use-api-keys";
import { showToast } from "@/lib/toast";
import { formatDate } from "@/lib/utils";
import { API_SCOPES, type ApiScope } from "@/types";

const SCOPE_BESKRIVELSE: Record<ApiScope, string> = {
  "bilag:read": "Les bilag og posteringer",
  "bilag:write": "Opprett og oppdater bilag",
  "klienter:read": "Les klientdata",
  "klienter:write": "Opprett og oppdater klienter",
  "rapporter:read": "Les rapporter og statistikk",
  "saft:export": "Eksporter SAF-T XML",
  "ai:chat": "Bruk AI-funksjoner",
  "admin": "Full administratortilgang",
};

const SCOPE_GRUPPER: { label: string; scopes: ApiScope[] }[] = [
  { label: "Bilag", scopes: ["bilag:read", "bilag:write"] },
  { label: "Klienter", scopes: ["klienter:read", "klienter:write"] },
  { label: "Rapporter og eksport", scopes: ["rapporter:read", "saft:export"] },
  { label: "Andre", scopes: ["ai:chat", "admin"] },
];

export default function UtviklerPage() {
  const { keys, loading, createKey, revokeKey } = useApiKeys();

  // Skjema-tilstand
  const [showForm, setShowForm] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [valgtScopes, setValgtScopes] = useState<ApiScope[]>(["bilag:read", "klienter:read", "rapporter:read"]);
  const [creating, setCreating] = useState(false);

  // Vis nyopprettet nøkkel
  const [newKey, setNewKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(true);

  function toggleScope(scope: ApiScope) {
    setValgtScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  }

  /** Opprett ny nøkkel */
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!keyName.trim() || valgtScopes.length === 0) return;

    setCreating(true);
    const key = await createKey(keyName.trim(), valgtScopes);
    if (key) {
      setNewKey(key);
      setKeyName("");
      setValgtScopes(["bilag:read", "klienter:read", "rapporter:read"]);
      setShowForm(false);
      showToast.success("API-nøkkel opprettet!");
    } else {
      showToast.error("Kunne ikke opprette API-nøkkel.");
    }
    setCreating(false);
  }

  /** Kopier nøkkel til utklippstavle */
  function copyKey(text: string) {
    navigator.clipboard.writeText(text);
    showToast.success("Kopiert til utklippstavlen!");
  }

  /** Tilbakekall nøkkel */
  async function handleRevoke(id: string) {
    const ok = await revokeKey(id);
    if (ok) {
      showToast.success("API-nøkkel tilbakekalt.");
    } else {
      showToast.error("Kunne ikke tilbakekalle nøkkelen.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Utvikler</h1>
          <p className="text-muted-foreground">
            Administrer API-nøkler med scope-basert tilgangskontroll.
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} disabled={showForm}>
          <Plus className="mr-2 h-4 w-4" />
          Opprett ny nøkkel
        </Button>
      </div>

      {/* Opprett-skjema */}
      {showForm && (
        <Card>
          <form onSubmit={handleCreate}>
            <CardHeader>
              <CardTitle>Ny API-nøkkel</CardTitle>
              <CardDescription>
                Gi nøkkelen et beskrivende navn og velg hvilke tilganger den skal ha.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="key-name">Navn</Label>
                <Input
                  id="key-name"
                  placeholder="f.eks. Produksjon, Testing, CI/CD..."
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Tilganger (scopes)
                </Label>
                {SCOPE_GRUPPER.map((gruppe) => (
                  <div key={gruppe.label}>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">{gruppe.label}</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {gruppe.scopes.map((scope) => (
                        <label
                          key={scope}
                          className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                            valgtScopes.includes(scope)
                              ? "border-primary bg-primary/5"
                              : "border-border hover:bg-accent/30"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={valgtScopes.includes(scope)}
                            onChange={() => toggleScope(scope)}
                            className="mt-0.5"
                          />
                          <div>
                            <p className="text-sm font-mono font-medium">{scope}</p>
                            <p className="text-xs text-muted-foreground">{SCOPE_BESKRIVELSE[scope]}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                {valgtScopes.length === 0 && (
                  <p className="text-xs text-destructive">Minst ett scope er påkrevd.</p>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button type="submit" disabled={creating || !keyName.trim() || valgtScopes.length === 0}>
                {creating ? <Spinner className="mr-2 h-4 w-4" /> : null}
                Opprett
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowForm(false)}
              >
                Avbryt
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {/* Nyopprettet nøkkel — vises bare én gang */}
      {newKey && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <AlertTriangle className="h-5 w-5" />
              Lagre nøkkelen nå
            </CardTitle>
            <CardDescription>
              Denne nøkkelen vises bare én gang. Kopier og lagre den et sikkert
              sted.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 rounded-md bg-muted p-3 font-mono text-sm">
              <code className="flex-1 break-all">
                {showKey ? newKey : "•".repeat(newKey.length)}
              </code>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => copyKey(newKey)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" onClick={() => setNewKey(null)}>
              Ferdig — jeg har lagret nøkkelen
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Eksisterende nøkler */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            API-nøkler
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : keys.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              Ingen API-nøkler ennå. Opprett en for å komme i gang.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Navn</TableHead>
                  <TableHead>Nøkkel</TableHead>
                  <TableHead>Tilganger</TableHead>
                  <TableHead>Opprettet</TableHead>
                  <TableHead>Sist brukt</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {key.prefix}...
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(key.scopes ?? []).map((scope) => (
                          <Badge key={scope} variant="secondary" className="text-xs font-mono">
                            {scope}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(key.createdAt)}</TableCell>
                    <TableCell>
                      {key.lastUsedAt ? formatDate(key.lastUsedAt) : "Aldri"}
                    </TableCell>
                    <TableCell>
                      {key.revoked ? (
                        <Badge variant="destructive">Tilbakekalt</Badge>
                      ) : (
                        <Badge variant="default">Aktiv</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {!key.revoked && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleRevoke(key.id)}
                        >
                          Tilbakekall
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Scope-referanse */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Scope-referanse
          </CardTitle>
          <CardDescription>
            Oversikt over tilgjengelige scopes og hva de gir tilgang til.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            {API_SCOPES.map((scope) => (
              <div key={scope} className="flex items-start gap-3 rounded-lg border border-border/50 p-3">
                <Badge variant="outline" className="font-mono text-xs shrink-0">
                  {scope}
                </Badge>
                <p className="text-xs text-muted-foreground">{SCOPE_BESKRIVELSE[scope]}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Brukseksempel */}
      <Card>
        <CardHeader>
          <CardTitle>Brukseksempel</CardTitle>
          <CardDescription>
            Bruk API-nøkkelen i forespørsler med <code>x-api-key</code>-headeren.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-md bg-muted p-4 text-sm">
            <code>{`# Les bilag (krever scope: bilag:read)
curl -X GET \\
  https://ketlcloud.web.app/api/v1/bilag \\
  -H "x-api-key: sk_live_din_nøkkel_her"

# Eksporter SAF-T (krever scope: saft:export)
curl -X GET \\
  https://ketlcloud.web.app/api/v1/klienter \\
  -H "x-api-key: sk_live_din_nøkkel_her"`}</code>
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
