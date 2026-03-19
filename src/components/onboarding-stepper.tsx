"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/firestore";
import { updateProfile } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardTitle,
} from "@/components/ui/card";
import {
  Receipt,
  Building2,
  Bot,
  Rocket,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

const TOTAL_STEPS = 4;

export function OnboardingStepper() {
  const { user, firebaseUser } = useAuth();
  const [show, setShow] = useState(false);
  const [checking, setChecking] = useState(true);
  const [step, setStep] = useState(0);

  // Steg 2 — klientregistrering
  const [firmanavn, setFirmanavn] = useState("");
  const [orgnr, setOrgnr] = useState("");

  useEffect(() => {
    if (!firebaseUser) {
      setChecking(false);
      return;
    }

    getDoc(doc(db, "users", firebaseUser.uid)).then((snap) => {
      if (!snap.exists() || !snap.data()?.onboardingComplete) {
        setShow(true);
      }
      setChecking(false);
    });
  }, [firebaseUser]);

  async function handleComplete() {
    if (!firebaseUser) return;

    // Oppdater visningsnavn med firmanavn hvis angitt
    if (firmanavn && !firebaseUser.displayName) {
      await updateProfile(firebaseUser, { displayName: firmanavn });
    }

    // Marker onboarding som fullført
    await setDoc(
      doc(db, "users", firebaseUser.uid),
      { onboardingComplete: true, firmanavn, orgnr },
      { merge: true }
    );
    setShow(false);
  }

  async function handleSkip() {
    if (!firebaseUser) return;
    await setDoc(
      doc(db, "users", firebaseUser.uid),
      { onboardingComplete: true },
      { merge: true }
    );
    setShow(false);
  }

  if (checking || !show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <Card className="mx-4 w-full max-w-lg">
        {/* Fremdriftsprikker */}
        <div className="flex justify-center gap-2 pt-6">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`h-2 w-2 rounded-full transition-colors ${
                i === step
                  ? "bg-primary"
                  : i < step
                    ? "bg-primary/50"
                    : "bg-muted"
              }`}
            />
          ))}
        </div>

        <CardContent className="p-6">
          {/* Steg 1: Velkommen */}
          {step === 0 && (
            <div className="space-y-4 text-center">
              <Receipt className="mx-auto h-12 w-12 text-primary" />
              <CardTitle className="text-xl">
                Velkommen til ketl regnskap!
              </CardTitle>
              <p className="text-muted-foreground">
                Din AI-drevne regnskapsmedarbeider er klar. La oss sette opp
                kontoen din på et par minutter.
              </p>
              <div className="grid gap-2 text-left pt-2">
                {[
                  "Automatisk bilagsbehandling med AI",
                  "NS 4102 kontoplan innebygd",
                  "MVA-beregning og rapportering",
                ].map((punkt) => (
                  <div key={punkt} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    {punkt}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Steg 2: Koble første klient */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="text-center">
                <Building2 className="mx-auto mb-3 h-10 w-10 text-primary" />
                <CardTitle className="text-xl">
                  Koble din første klient
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Skriv inn informasjon om bedriften du vil føre regnskap for.
                </p>
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Firmanavn</label>
                  <Input
                    value={firmanavn}
                    onChange={(e) => setFirmanavn(e.target.value)}
                    placeholder="Eksempel AS"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Organisasjonsnummer</label>
                  <Input
                    value={orgnr}
                    onChange={(e) => setOrgnr(e.target.value)}
                    placeholder="123 456 789"
                    maxLength={11}
                  />
                  <p className="text-xs text-muted-foreground">
                    9 siffer — finn det på Brønnøysundregistrene.no
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Steg 3: Slik fungerer AI-bokføring */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="text-center">
                <Bot className="mx-auto mb-3 h-10 w-10 text-primary" />
                <CardTitle className="text-xl">
                  Slik fungerer AI-bokføring
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  ketl regnskap automatiserer det meste for deg.
                </p>
              </div>

              <div className="grid gap-3">
                {[
                  {
                    steg: "1",
                    tittel: "Last opp bilag",
                    beskrivelse: "Dra og slipp kvitteringer og fakturaer — PDF, JPG eller PNG.",
                  },
                  {
                    steg: "2",
                    tittel: "AI analyserer",
                    beskrivelse: "Agenten leser bilaget og foreslår konto, MVA-kode og postering.",
                  },
                  {
                    steg: "3",
                    tittel: "Godkjenn eller rediger",
                    beskrivelse: "Du bekrefter forslaget med ett klikk, eller justerer om nødvendig.",
                  },
                  {
                    steg: "4",
                    tittel: "Rapporter genereres",
                    beskrivelse: "Resultatregnskap, balanse og MVA-rapport oppdateres automatisk.",
                  },
                ].map((item) => (
                  <div
                    key={item.steg}
                    className="flex items-start gap-3 rounded-lg border border-border/50 p-3"
                  >
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      {item.steg}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{item.tittel}</div>
                      <div className="text-xs text-muted-foreground">{item.beskrivelse}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Steg 4: Du er klar! */}
          {step === 3 && (
            <div className="space-y-4 text-center">
              <Rocket className="mx-auto h-12 w-12 text-primary" />
              <CardTitle className="text-xl">Du er klar!</CardTitle>
              <p className="text-muted-foreground">
                {firmanavn
                  ? `${firmanavn} er registrert som din første klient.`
                  : "Kontoen din er klar til bruk."}{" "}
                Klikk &laquo;Kom i gang&raquo; for å gå til dashboardet.
              </p>
              <div className="rounded-lg bg-accent/30 p-4 text-left">
                <p className="text-sm font-medium mb-2">Neste steg:</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0" />
                    Last opp ditt første bilag under &quot;Bilag&quot;
                  </li>
                  <li className="flex items-center gap-2">
                    <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0" />
                    Sjekk AI-forslagene og godkjenn bokføringen
                  </li>
                  <li className="flex items-center gap-2">
                    <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0" />
                    Se månedsoversikten under &quot;Rapporter&quot;
                  </li>
                </ul>
              </div>
            </div>
          )}
        </CardContent>

        {/* Navigasjon */}
        <CardContent className="flex items-center justify-between border-t pt-4">
          <Button variant="ghost" size="sm" onClick={handleSkip}>
            Hopp over
          </Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep((s) => s - 1)}
              >
                Forrige
              </Button>
            )}
            {step < TOTAL_STEPS - 1 ? (
              <Button size="sm" onClick={() => setStep((s) => s + 1)}>
                Neste
              </Button>
            ) : (
              <Button size="sm" onClick={handleComplete}>
                Kom i gang
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
