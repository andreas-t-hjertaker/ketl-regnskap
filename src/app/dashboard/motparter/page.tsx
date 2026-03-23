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
  Users,
  Truck,
  Plus,
  X,
  Trash2,
  Phone,
  Mail,
  MapPin,
  Building2,
  Pencil,
  Check,
} from "lucide-react";
import { SlideIn, StaggerList, StaggerItem } from "@/components/motion";
import { useAuth } from "@/hooks/use-auth";
import { useMotparter } from "@/hooks/use-motparter";
import { useAktivKlient } from "@/hooks/use-aktiv-klient";
import { useBrreg } from "@/hooks/use-brreg";
import { Loader2, CheckCircle2, AlertCircle as AlertCircleIcon } from "lucide-react";
import type { Motpart } from "@/types";

type Fane = "kunder" | "leverandorer";

function initials(navn: string) {
  return navn
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function OpprettSkjema({
  type,
  klientId,
  onLagret,
  onAvbryt,
  addMotpart,
}: {
  type: Motpart["type"];
  klientId: string;
  onLagret: () => void;
  onAvbryt: () => void;
  addMotpart: (data: Omit<Motpart, "opprettet">) => Promise<string | null>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [lagrer, setLagrer] = useState(false);
  const [orgnr, setOrgnr] = useState("");
  const [navn, setNavn] = useState("");
  const [adresse, setAdresse] = useState("");
  const { status: brregStatus, data: brregData } = useBrreg(orgnr);

  // Auto-fyll navn og adresse fra Brreg når enhet er funnet
  if (brregStatus === "funnet" && brregData) {
    if (!navn && brregData.navn) setNavn(brregData.navn);
    if (!adresse && brregData.adresse) setAdresse(brregData.adresse);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data: Omit<Motpart, "opprettet"> = {
      type,
      klientId,
      navn: fd.get("navn") as string,
      orgnr: orgnr.replace(/\s/g, "") || undefined,
      kontaktperson: (fd.get("kontaktperson") as string) || undefined,
      epost: (fd.get("epost") as string) || undefined,
      telefon: (fd.get("telefon") as string) || undefined,
      adresse: (fd.get("adresse") as string) || undefined,
    };
    setLagrer(true);
    const id = await addMotpart(data);
    setLagrer(false);
    if (id) {
      formRef.current?.reset();
      setOrgnr("");
      setNavn("");
      setAdresse("");
      onLagret();
    }
  }

  const typeNavn = type === "kunde" ? "Kunde" : "Leverandør";

  const brregMelding = (() => {
    if (brregStatus === "loading") return { ikon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, tekst: "Slår opp…", farge: "text-muted-foreground" };
    if (brregStatus === "funnet") return { ikon: <CheckCircle2 className="h-3.5 w-3.5" />, tekst: `Funnet: ${brregData?.enhet.navn}`, farge: "text-green-600" };
    if (brregStatus === "ikke_funnet") return { ikon: <AlertCircleIcon className="h-3.5 w-3.5" />, tekst: "Org.nr ikke funnet i Brønnøysundregistrene", farge: "text-amber-600" };
    if (brregStatus === "nettverksfeil") return { ikon: <AlertCircleIcon className="h-3.5 w-3.5" />, tekst: "Kunne ikke kontakte Brønnøysundregistrene", farge: "text-amber-600" };
    return null;
  })();

  return (
    <form ref={formRef} className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="orgnr">Org.nr</Label>
        <Input
          id="orgnr"
          name="orgnr"
          placeholder="123 456 789"
          value={orgnr}
          onChange={(e) => {
            setOrgnr(e.target.value);
            setNavn("");
            setAdresse("");
          }}
        />
        {brregMelding && (
          <p className={`flex items-center gap-1 text-xs ${brregMelding.farge}`}>
            {brregMelding.ikon}
            {brregMelding.tekst}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="navn">
          Navn *
          {brregStatus === "funnet" && (
            <span className="ml-2 text-xs font-normal text-green-600">autofylt</span>
          )}
        </Label>
        <Input
          id="navn"
          name="navn"
          placeholder={`${typeNavn}navn`}
          required
          value={navn}
          onChange={(e) => setNavn(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="kontaktperson">Kontaktperson</Label>
        <Input id="kontaktperson" name="kontaktperson" placeholder="Ola Nordmann" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="epost">E-post</Label>
        <Input id="epost" name="epost" type="email" placeholder="ola@eksempel.no" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="telefon">Telefon</Label>
        <Input id="telefon" name="telefon" placeholder="+47 900 00 000" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="adresse">
          Adresse
          {brregStatus === "funnet" && adresse && (
            <span className="ml-2 text-xs font-normal text-green-600">autofylt</span>
          )}
        </Label>
        <Input
          id="adresse"
          name="adresse"
          placeholder="Gateveien 1, 0001 Oslo"
          value={adresse}
          onChange={(e) => setAdresse(e.target.value)}
        />
      </div>
      <div className="sm:col-span-2 flex gap-2">
        <Button type="submit" disabled={lagrer}>
          {lagrer ? "Lagrer…" : `Legg til ${typeNavn.toLowerCase()}`}
        </Button>
        <Button type="button" variant="outline" onClick={onAvbryt}>
          Avbryt
        </Button>
      </div>
    </form>
  );
}

function MotpartKort({
  motpart,
  onDelete,
  onUpdate,
}: {
  motpart: Motpart & { id: string };
  onDelete: (id: string) => void;
  onUpdate: (id: string, data: Partial<Motpart>) => Promise<void>;
}) {
  const [redigerer, setRedigerer] = useState(false);
  const [lagrer, setLagrer] = useState(false);
  const editRef = useRef<HTMLFormElement>(null);

  async function handleRedigerSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLagrer(true);
    await onUpdate(motpart.id, {
      navn: fd.get("navn") as string,
      orgnr: (fd.get("orgnr") as string) || undefined,
      kontaktperson: (fd.get("kontaktperson") as string) || undefined,
      epost: (fd.get("epost") as string) || undefined,
      telefon: (fd.get("telefon") as string) || undefined,
      adresse: (fd.get("adresse") as string) || undefined,
    });
    setLagrer(false);
    setRedigerer(false);
  }

  if (redigerer) {
    return (
      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Rediger {motpart.type === "kunde" ? "kunde" : "leverandør"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form ref={editRef} onSubmit={handleRedigerSubmit} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`navn-${motpart.id}`}>Navn *</Label>
              <Input id={`navn-${motpart.id}`} name="navn" defaultValue={motpart.navn} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`orgnr-${motpart.id}`}>Org.nr</Label>
              <Input id={`orgnr-${motpart.id}`} name="orgnr" defaultValue={motpart.orgnr ?? ""} placeholder="123 456 789" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`kontakt-${motpart.id}`}>Kontaktperson</Label>
              <Input id={`kontakt-${motpart.id}`} name="kontaktperson" defaultValue={motpart.kontaktperson ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`epost-${motpart.id}`}>E-post</Label>
              <Input id={`epost-${motpart.id}`} name="epost" type="email" defaultValue={motpart.epost ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`tlf-${motpart.id}`}>Telefon</Label>
              <Input id={`tlf-${motpart.id}`} name="telefon" defaultValue={motpart.telefon ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`adr-${motpart.id}`}>Adresse</Label>
              <Input id={`adr-${motpart.id}`} name="adresse" defaultValue={motpart.adresse ?? ""} />
            </div>
            <div className="sm:col-span-2 flex gap-2">
              <Button type="submit" size="sm" disabled={lagrer}>
                <Check className="mr-1.5 h-3.5 w-3.5" />
                {lagrer ? "Lagrer…" : "Lagre"}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setRedigerer(false)}>
                Avbryt
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover:border-border transition-colors group relative">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold">
            {initials(motpart.navn)}
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base group-hover:text-primary transition-colors">
              {motpart.navn}
            </CardTitle>
            {motpart.orgnr && (
              <CardDescription className="font-mono text-xs mt-0.5">
                Org.nr: {motpart.orgnr}
              </CardDescription>
            )}
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setRedigerer(true)}
              title="Rediger"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => onDelete(motpart.id)}
              title="Slett"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {motpart.kontaktperson && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-3.5 w-3.5 shrink-0" />
            <span>{motpart.kontaktperson}</span>
          </div>
        )}
        {motpart.epost && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{motpart.epost}</span>
          </div>
        )}
        {motpart.telefon && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-3.5 w-3.5 shrink-0" />
            <span>{motpart.telefon}</span>
          </div>
        )}
        {motpart.adresse && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{motpart.adresse}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function MotparterPage() {
  const { user } = useAuth();
  const { aktivKlient, aktivKlientId } = useAktivKlient();
  const { kunder, leverandorer, loading, addMotpart, updateMotpart, deleteMotpart } = useMotparter(
    user?.uid ?? null,
    aktivKlientId
  );
  const [aktivFane, setAktivFane] = useState<Fane>("kunder");
  const [visSkjema, setVisSkjema] = useState(false);
  const [søk, setSøk] = useState("");

  const liste = aktivFane === "kunder" ? kunder : leverandorer;
  const filtrerte = liste.filter(
    (m) =>
      m.navn.toLowerCase().includes(søk.toLowerCase()) ||
      (m.orgnr ?? "").includes(søk) ||
      (m.epost ?? "").toLowerCase().includes(søk.toLowerCase())
  );

  const ingenKlient = !aktivKlient && !aktivKlientId;

  return (
    <div className="space-y-6">
      {/* Toppseksjon */}
      <SlideIn direction="up" duration={0.4}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Motparter</h1>
            <p className="text-muted-foreground">
              Kunder og leverandører per klient. Påkrevd for SAF-T-eksport.
            </p>
          </div>
          {!ingenKlient && (
            <Button onClick={() => setVisSkjema(!visSkjema)}>
              {visSkjema ? (
                <>
                  <X className="mr-2 h-4 w-4" />
                  Avbryt
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  {aktivFane === "kunder" ? "Ny kunde" : "Ny leverandør"}
                </>
              )}
            </Button>
          )}
        </div>
      </SlideIn>

      {/* Ingen klient valgt */}
      {ingenKlient && (
        <SlideIn direction="up">
          <div className="rounded-xl border border-border/40 py-12 text-center text-muted-foreground">
            <Building2 className="mx-auto mb-3 h-8 w-8 opacity-40" />
            <p className="text-sm font-medium">Velg en klient i sidemenyen</p>
            <p className="text-xs mt-1">Motparter er knyttet til en spesifikk regnskapsklient.</p>
          </div>
        </SlideIn>
      )}

      {!ingenKlient && (
        <>
          {/* Opprett-skjema */}
          {visSkjema && aktivKlientId && (
            <SlideIn direction="up">
              <Card className="border-primary/30">
                <CardHeader>
                  <CardTitle className="text-base">
                    Legg til {aktivFane === "kunder" ? "kunde" : "leverandør"}
                  </CardTitle>
                  {aktivKlient && (
                    <CardDescription>Klient: {aktivKlient.navn}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <OpprettSkjema
                    type={aktivFane === "kunder" ? "kunde" : "leverandor"}
                    klientId={aktivKlientId}
                    onLagret={() => setVisSkjema(false)}
                    onAvbryt={() => setVisSkjema(false)}
                    addMotpart={addMotpart}
                  />
                </CardContent>
              </Card>
            </SlideIn>
          )}

          {/* Faner */}
          <SlideIn direction="up" delay={0.1}>
            <div className="flex gap-1 rounded-lg border border-border/50 p-1 w-fit">
              <Button
                variant={aktivFane === "kunder" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => { setAktivFane("kunder"); setVisSkjema(false); }}
                className="gap-1.5"
              >
                <Users className="h-3.5 w-3.5" />
                Kunder
                <Badge variant="secondary" className="ml-1 text-xs px-1.5">
                  {kunder.length}
                </Badge>
              </Button>
              <Button
                variant={aktivFane === "leverandorer" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => { setAktivFane("leverandorer"); setVisSkjema(false); }}
                className="gap-1.5"
              >
                <Truck className="h-3.5 w-3.5" />
                Leverandører
                <Badge variant="secondary" className="ml-1 text-xs px-1.5">
                  {leverandorer.length}
                </Badge>
              </Button>
            </div>
          </SlideIn>

          {/* Søk */}
          <SlideIn direction="up" delay={0.12}>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder={`Søk etter ${aktivFane === "kunder" ? "kunde" : "leverandør"}…`}
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

          {/* Kort-grid */}
          {!loading && filtrerte.length > 0 && (
            <StaggerList className="grid gap-4 sm:grid-cols-2" staggerDelay={0.07}>
              {filtrerte.map((m) => (
                <StaggerItem key={m.id}>
                  <MotpartKort motpart={m} onDelete={deleteMotpart} onUpdate={updateMotpart} />
                </StaggerItem>
              ))}
            </StaggerList>
          )}

          {/* Tom tilstand */}
          {!loading && filtrerte.length === 0 && (
            <SlideIn direction="up">
              <div className="rounded-xl border border-border/40 py-12 text-center text-muted-foreground">
                {aktivFane === "kunder" ? (
                  <Users className="mx-auto mb-3 h-8 w-8 opacity-40" />
                ) : (
                  <Truck className="mx-auto mb-3 h-8 w-8 opacity-40" />
                )}
                {søk ? (
                  <p className="text-sm">Ingen treff på søket ditt.</p>
                ) : (
                  <>
                    <p className="text-sm font-medium">
                      Ingen {aktivFane === "kunder" ? "kunder" : "leverandører"} ennå
                    </p>
                    <p className="text-xs mt-1">
                      Klikk «{aktivFane === "kunder" ? "Ny kunde" : "Ny leverandør"}» for å legge til.
                    </p>
                  </>
                )}
              </div>
            </SlideIn>
          )}
        </>
      )}
    </div>
  );
}
