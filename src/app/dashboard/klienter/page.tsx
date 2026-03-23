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
  Loader2,
  CheckCircle2,
  AlertCircle,
  Download,
  Pencil,
  Check,
} from "lucide-react";
import Link from "next/link";
import { SlideIn, StaggerList, StaggerItem } from "@/components/motion";
import { useAuth } from "@/hooks/use-auth";
import { useKlienter } from "@/hooks/use-klienter";
import { useBrreg } from "@/hooks/use-brreg";
import { useAktivKlient } from "@/hooks/use-aktiv-klient";
import { eksporterKlienterCsv } from "@/lib/eksport";
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

function OpprettKlientSkjema({ onLagret, onAvbryt }: { onLagret: () => void; onAvbryt: () => void }) {
  const { user } = useAuth();
  const { addKlient } = useKlienter(user?.uid ?? null);
  const formRef = useRef<HTMLFormElement>(null);
  const [lagrer, setLagrer] = useState(false);

  // Kontrollerte felt for brreg-autofyll
  const [orgnr, setOrgnr] = useState("");
  const [navn, setNavn] = useState("");
  const [adresse, setAdresse] = useState("");
  const [bransje, setBransje] = useState("");

  const { status: brregStatus, data: brregData } = useBrreg(orgnr);

  // Autofyll når brreg-oppslag lykkes
  const forrigeBrregOrgnr = useRef<string>("");
  if (brregStatus === "funnet" && brregData && orgnr !== forrigeBrregOrgnr.current) {
    forrigeBrregOrgnr.current = orgnr;
    if (!navn) setNavn(brregData.navn);
    if (!adresse && brregData.adresse) setAdresse(brregData.adresse);
    if (!bransje && brregData.bransje) setBransje(brregData.bransje);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data: Omit<Klient, "opprettet"> = {
      navn: fd.get("navn") as string,
      orgnr: orgnr.replace(/\s/g, ""),
      kontaktperson: fd.get("kontaktperson") as string,
      epost: fd.get("epost") as string,
      telefon: (fd.get("telefon") as string) || undefined,
      bransje: bransje || undefined,
      adresse: adresse || undefined,
    };

    setLagrer(true);
    const id = await addKlient(data);
    setLagrer(false);

    if (id) {
      formRef.current?.reset();
      setOrgnr("");
      setNavn("");
      setAdresse("");
      setBransje("");
      forrigeBrregOrgnr.current = "";
      onLagret();
    }
  }

  const brregMelding = (() => {
    if (brregStatus === "loading") return { ikon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, tekst: "Slår opp…", farge: "text-muted-foreground" };
    if (brregStatus === "funnet") return { ikon: <CheckCircle2 className="h-3.5 w-3.5" />, tekst: `Funnet: ${brregData?.enhet.navn}`, farge: "text-green-600" };
    if (brregStatus === "ikke_funnet") return { ikon: <AlertCircle className="h-3.5 w-3.5" />, tekst: "Org.nr ikke funnet i Brønnøysundregistrene", farge: "text-amber-600" };
    if (brregStatus === "nettverksfeil") return { ikon: <AlertCircle className="h-3.5 w-3.5" />, tekst: "Kunne ikke kontakte Brønnøysundregistrene", farge: "text-amber-600" };
    return null;
  })();

  return (
    <form ref={formRef} className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
      {/* Orgnr med Brreg-status */}
      <div className="space-y-2">
        <Label htmlFor="orgnr">Organisasjonsnummer *</Label>
        <Input
          id="orgnr"
          name="orgnr"
          placeholder="123 456 789"
          required
          value={orgnr}
          onChange={(e) => {
            setOrgnr(e.target.value);
            // Nullstill autofylte felt når orgnr endres
            forrigeBrregOrgnr.current = "";
            setNavn("");
            setAdresse("");
            setBransje("");
          }}
        />
        {brregMelding && (
          <p className={`flex items-center gap-1 text-xs ${brregMelding.farge}`}>
            {brregMelding.ikon}
            {brregMelding.tekst}
          </p>
        )}
      </div>

      {/* Firmanavn — autofylt fra Brreg */}
      <div className="space-y-2">
        <Label htmlFor="navn">
          Firmanavn *
          {brregStatus === "funnet" && (
            <span className="ml-2 text-xs font-normal text-green-600">autofylt</span>
          )}
        </Label>
        <Input
          id="navn"
          name="navn"
          placeholder="Eksempel AS"
          required
          value={navn}
          onChange={(e) => setNavn(e.target.value)}
        />
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

      {/* Bransje — autofylt fra næringskode */}
      <div className="space-y-2">
        <Label htmlFor="bransje">
          Bransje
          {brregStatus === "funnet" && bransje && (
            <span className="ml-2 text-xs font-normal text-green-600">autofylt</span>
          )}
        </Label>
        <Input
          id="bransje"
          name="bransje"
          placeholder="IT og teknologi"
          value={bransje}
          onChange={(e) => setBransje(e.target.value)}
        />
      </div>

      {/* Adresse — autofylt fra forretningsadresse */}
      <div className="sm:col-span-2 space-y-2">
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
          {lagrer ? "Lagrer…" : "Lagre klient"}
        </Button>
        <Button type="button" variant="outline" onClick={onAvbryt}>
          Avbryt
        </Button>
      </div>
    </form>
  );
}

export default function KlienterPage() {
  const { user } = useAuth();
  const { klienter, loading, updateKlient, deleteKlient } = useKlienter(user?.uid ?? null);
  const { setAktivKlient } = useAktivKlient();
  const [visOpprettSkjema, setVisOpprettSkjema] = useState(false);
  const [redigererKlientId, setRedigererKlientId] = useState<string | null>(null);
  const [lagrerRedigering, setLagrerRedigering] = useState(false);
  const [søk, setSøk] = useState("");

  async function handleKlientRedigering(e: React.FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLagrerRedigering(true);
    await updateKlient(id, {
      navn: fd.get("navn") as string,
      kontaktperson: fd.get("kontaktperson") as string,
      epost: fd.get("epost") as string,
      telefon: (fd.get("telefon") as string) || undefined,
      bransje: (fd.get("bransje") as string) || undefined,
      adresse: (fd.get("adresse") as string) || undefined,
      bankkontonr: (fd.get("bankkontonr") as string) || undefined,
      betalingsbetingelseDager: fd.get("betalingsbetingelseDager")
        ? parseInt(fd.get("betalingsbetingelseDager") as string, 10)
        : undefined,
    });
    setLagrerRedigering(false);
    setRedigererKlientId(null);
  }

  const filtrerte = klienter.filter(
    (k) =>
      k.navn.toLowerCase().includes(søk.toLowerCase()) ||
      k.orgnr.includes(søk) ||
      (k.bransje ?? "").toLowerCase().includes(søk.toLowerCase())
  );

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
          <div className="flex gap-2">
            {!loading && klienter.length > 0 && (
              <Button
                variant="outline"
                onClick={() => eksporterKlienterCsv(klienter)}
              >
                <Download className="mr-2 h-4 w-4" />
                Eksporter CSV
              </Button>
            )}
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
        </div>
      </SlideIn>

      {/* Opprett ny klient-skjema */}
      {visOpprettSkjema && (
        <SlideIn direction="up">
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="text-base">Legg til ny klient</CardTitle>
              <CardDescription>
                Skriv inn organisasjonsnummeret — vi henter firmainfo automatisk fra Brønnøysundregistrene.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <OpprettKlientSkjema
                onLagret={() => setVisOpprettSkjema(false)}
                onAvbryt={() => setVisOpprettSkjema(false)}
              />
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
              {redigererKlientId === klient.id ? (
                <Card className="border-primary/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Rediger klient</CardTitle>
                    <CardDescription className="font-mono text-xs">Org.nr: {klient.orgnr}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={(e) => handleKlientRedigering(e, klient.id)} className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor={`k-navn-${klient.id}`}>Firmanavn *</Label>
                        <Input id={`k-navn-${klient.id}`} name="navn" defaultValue={klient.navn} required />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`k-kontakt-${klient.id}`}>Kontaktperson *</Label>
                        <Input id={`k-kontakt-${klient.id}`} name="kontaktperson" defaultValue={klient.kontaktperson} required />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`k-epost-${klient.id}`}>E-post *</Label>
                        <Input id={`k-epost-${klient.id}`} name="epost" type="email" defaultValue={klient.epost} required />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`k-tlf-${klient.id}`}>Telefon</Label>
                        <Input id={`k-tlf-${klient.id}`} name="telefon" defaultValue={klient.telefon ?? ""} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`k-bransje-${klient.id}`}>Bransje</Label>
                        <Input id={`k-bransje-${klient.id}`} name="bransje" defaultValue={klient.bransje ?? ""} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`k-adr-${klient.id}`}>Adresse</Label>
                        <Input id={`k-adr-${klient.id}`} name="adresse" defaultValue={klient.adresse ?? ""} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`k-bank-${klient.id}`}>Bankkontonr. (faktura)</Label>
                        <Input id={`k-bank-${klient.id}`} name="bankkontonr" className="font-mono text-sm" placeholder="1234.56.78901" defaultValue={klient.bankkontonr ?? ""} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`k-bet-${klient.id}`}>Betalingsfrist (dager)</Label>
                        <Input id={`k-bet-${klient.id}`} name="betalingsbetingelseDager" type="number" min={1} max={90} defaultValue={klient.betalingsbetingelseDager ?? 14} />
                      </div>
                      <div className="sm:col-span-2 flex gap-2">
                        <Button type="submit" size="sm" disabled={lagrerRedigering}>
                          <Check className="mr-1.5 h-3.5 w-3.5" />
                          {lagrerRedigering ? "Lagrer…" : "Lagre"}
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => setRedigererKlientId(null)}>
                          Avbryt
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              ) : (
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
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setRedigererKlientId(klient.id)}
                        title="Rediger klient"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => deleteKlient(klient.id)}
                        title="Slett klient"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
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
                    <Link
                      href="/dashboard/bilag"
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                      onClick={() => setAktivKlient(klient)}
                    >
                      <Receipt className="h-3.5 w-3.5" />
                      <span>Vis bilag →</span>
                    </Link>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Opprettet {formatDato(klient.opprettet)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              )}
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
