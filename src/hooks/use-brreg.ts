"use client";

import { useState, useEffect } from "react";
import { hentEnhet, formaterAdresse, gjettBransje } from "@/lib/brreg";
import type { BrregEnhet } from "@/lib/brreg";

export type BrregStatus = "idle" | "loading" | "funnet" | "ikke_funnet" | "ugyldig_orgnr" | "nettverksfeil";

export type BrregData = {
  navn: string;
  adresse: string;
  bransje?: string;
  enhet: BrregEnhet;
};

/**
 * Debounced hook som slår opp organisasjonsnummer mot Brønnøysundregistrene.
 * Trigger: 9 siffer (mellomrom tillatt). Debounce: 500 ms.
 */
export function useBrreg(orgnr: string) {
  const [status, setStatus] = useState<BrregStatus>("idle");
  const [data, setData] = useState<BrregData | null>(null);

  useEffect(() => {
    const sifre = orgnr.replace(/\s/g, "");

    // Bare trigger når vi har nøyaktig 9 siffer
    if (!/^\d{9}$/.test(sifre)) {
      setStatus(sifre.length === 0 ? "idle" : sifre.length < 9 ? "idle" : "ugyldig_orgnr");
      setData(null);
      return;
    }

    setStatus("loading");
    setData(null);

    const timer = setTimeout(async () => {
      const resultat = await hentEnhet(sifre);
      if (resultat.ok) {
        setData({
          navn: resultat.enhet.navn,
          adresse: formaterAdresse(resultat.enhet),
          bransje: gjettBransje(resultat.enhet),
          enhet: resultat.enhet,
        });
        setStatus("funnet");
      } else {
        setData(null);
        setStatus(resultat.feil);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [orgnr]);

  return { status, data };
}
