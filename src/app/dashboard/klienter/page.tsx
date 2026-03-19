"use client";

import { useState } from "react";
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
import {
  Building2,
  Plus,
  Receipt,
  Clock,
  Phone,
  Mail,
  MapPin,
  X,
} from "lucide-react";
import { SlideIn, StaggerList, StaggerItem } from "@/components/motion";
import type { Klient } from "@/types";

type KlientMedMeta = Klient & {
  id: string;
  antallBilag: number;
  sisteAktivitet: string;
  bransje: string;
};

const mockKlienter: KlientMedMeta[] = [
  {
    id: "klient-1",
    navn: "Nordmark Bygg AS",
    orgnr: "921 456 789",
    kontaktperson: "Erik Nordmann",
    epost: "erik@nordmarkbygg.no",
    telefon: "+47 900 12 345",
    adresse: "Byggeveien 12, 0150 Oslo",
    bransje: "Bygg og anlegg",
    opprettet: new Date("2025-09-01"),
    antallBilag: 127,
    sisteAktivitet: "2 timer siden",
  },
  {
    id: "klient-2",
    navn: "TechStart Norge AS",
    orgnr: "934 678 901",
    kontaktperson: "Ingrid Larsen",
    epost: "ingrid@techstart.no",
    telefon: "+47 912 34 567",
    adresse: "Innovasjonsveien 5, 5008 Bergen",
    bransje: "IT og teknologi",
    opprettet: new Date("2025-11-15"),
    antallBilag: 84,
    sisteAktivitet: "I går",
  },
  {
    id: "klient-3",
    navn: "Fjordland Restaurant AS",
    orgnr: "918 234 567",
    kontaktperson: "Marte Fjord",
    epost: "marte@fjordland.no",
    telefon: "+47 456 78 901",
    adresse: "Strandgaten 22, 5004 Bergen",
    bransje: "Restaurant og servering",
    opprettet: new Date("2026-01-10"),
    antallBilag: 43,
    sisteAktivitet: "3 dager siden",
  },
  {
    id: "klient-4",
    navn: "Solberg Konsult ENK",
    orgnr: "887 654 321",
    kontaktperson: "Per Solberg",
    epost: "per@solbergkonsult.no",
    adresse: "Konsulentgata 8, 7010 Trondheim",
    bransje: "Konsulentvirksomhet",
    opprettet: new Date("2026-02-01"),
    antallBilag: 21,
    sisteAktivitet: "1 uke siden",
  },
];

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

export default function KlienterPage() {
  const [visOpprettSkjema, setVisOpprettSkjema] = useState(false);
  const [søk, setSøk] = useState("");

  const filtrerte = mockKlienter.filter(
    (k) =>
      k.navn.toLowerCase().includes(søk.toLowerCase()) ||
      k.orgnr.includes(søk) ||
      k.bransje.toLowerCase().includes(søk.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Toppseksjon */}
      <SlideIn direction="up" duration={0.4}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Klienter</h1>
            <p className="text-muted-foreground">
              Oversikt over regnskapsklienter. {mockKlienter.length} aktive klienter.
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
                className="grid gap-4 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  setVisOpprettSkjema(false);
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="navn">Firmanavn *</Label>
                  <Input id="navn" placeholder="Eksempel AS" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="orgnr">Organisasjonsnummer *</Label>
                  <Input id="orgnr" placeholder="123 456 789" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="kontaktperson">Kontaktperson *</Label>
                  <Input id="kontaktperson" placeholder="Ola Nordmann" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="epost">E-post *</Label>
                  <Input id="epost" type="email" placeholder="ola@eksempel.no" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefon">Telefon</Label>
                  <Input id="telefon" placeholder="+47 900 00 000" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bransje">Bransje</Label>
                  <Input id="bransje" placeholder="IT og teknologi" />
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="adresse">Adresse</Label>
                  <Input id="adresse" placeholder="Gateveien 1, 0001 Oslo" />
                </div>
                <div className="sm:col-span-2 flex gap-2">
                  <Button type="submit">Lagre klient</Button>
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

      {/* Klientkort */}
      <StaggerList className="grid gap-4 sm:grid-cols-2" staggerDelay={0.07}>
        {filtrerte.map((klient) => (
          <StaggerItem key={klient.id}>
            <Card className="hover:border-border transition-colors cursor-pointer group">
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
                      <Badge
                        className={`text-xs font-normal ${bransjeFarge[klient.bransje] ?? "bg-muted text-muted-foreground"}`}
                      >
                        {klient.bransje}
                      </Badge>
                    </div>
                    <CardDescription className="font-mono text-xs mt-0.5">
                      Org.nr: {klient.orgnr}
                    </CardDescription>
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
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Receipt className="h-3.5 w-3.5" />
                    <span>{klient.antallBilag} bilag</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Aktiv {klient.sisteAktivitet}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </StaggerItem>
        ))}
      </StaggerList>

      {filtrerte.length === 0 && (
        <SlideIn direction="up">
          <div className="rounded-xl border border-border/40 py-12 text-center text-muted-foreground">
            <Building2 className="mx-auto mb-3 h-8 w-8 opacity-40" />
            <p className="text-sm">Ingen klienter matcher søket ditt.</p>
          </div>
        </SlideIn>
      )}
    </div>
  );
}
