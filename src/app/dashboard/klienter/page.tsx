"use client";

import { useState, useRef } from "react";
import { Badge } from "@/components/ui/badge";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  Plus,
  Receipt,
  Clock,
  Phone,
  Mail,
  MapPin,
  X,
  Trash2,
} from "lucide-react";
import { SlideIn, StaggerList, StaggerItem } from "@/components/motion";
import { useAuth } from "@/hooks/use-auth";
import { useKlienter } from "@/hooks/use-klienter";
import type { Klient } from "@/types";

function initials(navn: string) {
  return navn
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

const bransjeFarge: Record<string, string> = {
  "Bygg og anlegg": "bg-orange-500/10 text-orange-600",
  "IT og teknologi": "bg-blue-500/10 text-blue-600",
  "Restaurant og servering": "bg-green-500/10 text-green-600",
  "Konsulentvirksomhet": "bg-purple-500/10 text-purple-600",
};

function formatDato(dato: unknown): string {
  if (!dato) return "—";
  const d = dato instanceof Date ? dato : new Date((dato as { seconds: number }).seconds * 1000);
  return d.toLocaleDateString("nb-NO", { day: "2-digit", month: "short", year: "numeric" });
}

export default function KlienterPage() {
  const { user } = useAuth();
  const { klienter, loading, addKlient, deleteKlient } = useKlienter(user?.uid ?? null);
  const [visOpprettSkjema, setVisOpprettSkjema] = useState(false);
  const [søk, setSøk] = useState("");
  const [lagrer, setLagrer] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const filtrerte = klienter.filter(
    (k) =>
      k.navn.toLowerCase().includes(søk.toLowerCase()) ||
      k.orgnr.includes(søk) ||
      (k.bransje ?? "").toLowerCase().includes(søk.toLowerCase())
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data: Omit<Klient, "opprettet"> = {
      navn: fd.get("navn") as string,
      orgnr: fd.get("orgnr") as string,
      kontaktperson: fd.get("kontaktperson") as string,
      epost: fd.get("epost") as string,
      telefon: (fd.get("telefon") as string) || undefined,
      bransje: (fd.get("bransje") as string) || undefined,
      adresse: (fd.get("adresse") as string) || undefined,
    };

    setLagrer(true);
    const id = await addKlient(data);
    setLagrer(false);

    if (id) {
      formRef.current?.reset();
      setVisOpprettSkjema(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Toppseksjon */}
      <SlideIn direction="up" duration={0.4}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Klienter</h1>
            <p className="text-muted-foreground">
              Oversikt over regnskapsklienter.{" "}
              {!loading && `${klienter.length} aktive klienter.`}
            </p>
          </div>
          <Button onClick={() => setVisOpprettSkjema(!visOpprettSkjema)}>
            {visOpprettSkjema ? (
              <>
                <X className="mr-2 h-4 w-4" />
                Avbryt
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Ny klient
              </>
            )}
          </Button>
        </div>
      </SlideIn>

      {/* Opprett ny klient-skjema */}
      {visOpprettSkjema && (
        <SlideIn direction="up">
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="text-base">Legg til ny klient</CardTitle>
              <CardDescription>
                Fyll inn informasjon om bedriften.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                ref={formRef}
                className="grid gap-4 sm:grid-cols-2"
                onSubmit={handleSubmit}
              >
                <div className="space-y-2">
                  <Label htmlFor="navn">Firmanavn *</Label>
                  <Input id="navn" name="navn" placeholder="Eksempel AS" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="orgnr">Organisasjonsnummer *</Label>
                  <Input id="orgnr" name="orgnr" placeholder="123456789" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="kontaktperson">Kontaktperson *</Label>
                  <Input id="kontaktperson" name="kontaktperson" placeholder="Ola Nordmann" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="epost">E-post *</Label>
                  <Input id="epost" name="epost" type="email" placeholder="ola@eksempel.no" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefon">Telefon</Label>
                  <Input id="telefon" name="telefon" placeholder="+47 900 00 000" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bransje">Bransje</Label>
                  <Input id="bransje" name="bransje" placeholder="IT og teknologi" />
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="adresse">Adresse</Label>
                  <Input id="adresse" name="adresse" placeholder="Gateveien 1, 0001 Oslo" />
                </div>
                <div className="sm:col-span-2 flex gap-2">
                  <Button type="submit" disabled={lagrer}>
                    {lagrer ? "Lagrer…" : "Lagre klient"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setVisOpprettSkjema(false)}
                  >
                    Avbryt
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </SlideIn>
      )}

      {/* Søk */}
      <SlideIn direction="up" delay={0.1}>
        <div className="relative">
          <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Søk etter klient, org.nr eller bransje…"
            value={søk}
            onChange={(e) => setSøk(e.target.value)}
          />
        </div>
      </SlideIn>

      {/* Laste-skjeletoner */}
      {loading && (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Klientkort */}
      {!loading && (
        <StaggerList className="grid gap-4 sm:grid-cols-2" staggerDelay={0.07}>
          {filtrerte.map((klient) => (
            <StaggerItem key={klient.id}>
              <Card className="hover:border-border transition-colors group relative">
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold">
                      {initials(klient.navn)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-base group-hover:text-primary transition-colors">
                          {klient.navn}
                        </CardTitle>
                        {klient.bransje && (
                          <Badge
                            className={`text-xs font-normal ${bransjeFarge[klient.bransje] ?? "bg-muted text-muted-foreground"}`}
                          >
                            {klient.bransje}
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="font-mono text-xs mt-0.5">
                        Org.nr: {klient.orgnr}
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 text-destructive hover:text-destructive shrink-0"
                      onClick={() => deleteKlient(klient.id)}
                      title="Slett klient"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{klient.epost}</span>
                  </div>
                  {klient.telefon && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      <span>{klient.telefon}</span>
                    </div>
                  )}
                  {klient.adresse && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{klient.adresse}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-border/40">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Receipt className="h-3.5 w-3.5" />
                      <span>Klient</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Opprettet {formatDato(klient.opprettet)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </StaggerList>
      )}

      {!loading && filtrerte.length === 0 && (
        <SlideIn direction="up">
          <div className="rounded-xl border border-border/40 py-12 text-center text-muted-foreground">
            <Building2 className="mx-auto mb-3 h-8 w-8 opacity-40" />
            {søk ? (
              <p className="text-sm">Ingen klienter matcher søket ditt.</p>
            ) : (
              <>
                <p className="text-sm font-medium">Ingen klienter ennå</p>
                <p className="text-xs mt-1">Legg til din første klient med knappen over.</p>
              </>
            )}
          </div>
        </SlideIn>
      )}
    </div>
  );
}
