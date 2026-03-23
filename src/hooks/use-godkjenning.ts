"use client";

/**
 * Godkjenningskjede for bilag (#128).
 *
 * Attestasjon: bekrefter at bilagets innhold er saklig korrekt.
 * Anvisning:   autoriserer betaling (høyere myndighet).
 *
 * Tilstand lagres direkte på bilag-dokumentet under `godkjenning`-feltet.
 */

import { useCallback } from "react";
import { updateDocument } from "@/lib/firebase/firestore";
import { loggHandling } from "@/lib/audit";
import { showToast } from "@/lib/toast";
import { useAuth } from "@/hooks/use-auth";
import type { Godkjenningskjede, GodkjenningTrinn } from "@/types";

export function useGodkjenning(uid: string | null) {
  const { user } = useAuth();
  const path = uid ? `users/${uid}/bilag` : null;

  /** Start godkjenningskjede på et bilag (setter attestasjon=venter, anvisning=venter) */
  const startGodkjenning = useCallback(
    async (bilagId: string, medAnvisning = true): Promise<void> => {
      if (!uid || !path) return;
      const kjede: Godkjenningskjede = {
        attestasjon: { rolle: "attestant", status: "venter" },
        anvisning: medAnvisning ? { rolle: "anviser", status: "venter" } : undefined,
        ferdig: false,
      };
      try {
        await updateDocument(path, bilagId, { godkjenning: kjede });
        await loggHandling(uid, "godkjenning_startet", "bilag", bilagId, {
          medAnvisning,
        });
        showToast.success("Godkjenningskjede startet.");
      } catch {
        showToast.error("Klarte ikke starte godkjenningskjede.");
      }
    },
    [uid, path]
  );

  /** Utfør ett godkjenningstrinn */
  const gjørGodkjenning = useCallback(
    async (
      bilagId: string,
      gjeldende: Godkjenningskjede,
      trinn: "attestasjon" | "anvisning",
      beslutning: "godkjent" | "avvist",
      merknad?: string
    ): Promise<void> => {
      if (!uid || !path || !user) return;

      const oppdatertTrinn: GodkjenningTrinn = {
        rolle: trinn === "attestasjon" ? "attestant" : "anviser",
        uid,
        navn: user.displayName ?? user.email ?? uid,
        status: beslutning,
        tidspunkt: new Date().toISOString(),
        merknad,
      };

      const nyKjede: Godkjenningskjede = {
        ...gjeldende,
        [trinn]: oppdatertTrinn,
        ferdig: false,
      };

      // Kjeden er ferdig når siste nødvendige trinn er godkjent
      const attestOk =
        !nyKjede.attestasjon || nyKjede.attestasjon.status === "godkjent";
      const anvisningOk =
        !nyKjede.anvisning || nyKjede.anvisning.status === "godkjent";
      const avvist =
        nyKjede.attestasjon?.status === "avvist" ||
        nyKjede.anvisning?.status === "avvist";

      nyKjede.ferdig = (attestOk && anvisningOk) || avvist;

      try {
        await updateDocument(path, bilagId, { godkjenning: nyKjede });

        const handling =
          beslutning === "avvist"
            ? "bilag_godkjenning_avvist"
            : trinn === "attestasjon"
            ? "bilag_attestert"
            : "bilag_anvist";

        await loggHandling(uid, handling, "bilag", bilagId, {
          trinn,
          beslutning,
          merknad,
          ferdig: nyKjede.ferdig,
        });

        const label =
          beslutning === "godkjent"
            ? trinn === "attestasjon"
              ? "Bilaget er attestert."
              : "Bilaget er anvist."
            : "Godkjenning avvist.";

        showToast.success(label);
      } catch {
        showToast.error("Klarte ikke registrere godkjenning.");
      }
    },
    [uid, path, user]
  );

  const attester = useCallback(
    (bilagId: string, kjede: Godkjenningskjede, merknad?: string) =>
      gjørGodkjenning(bilagId, kjede, "attestasjon", "godkjent", merknad),
    [gjørGodkjenning]
  );

  const anvis = useCallback(
    (bilagId: string, kjede: Godkjenningskjede, merknad?: string) =>
      gjørGodkjenning(bilagId, kjede, "anvisning", "godkjent", merknad),
    [gjørGodkjenning]
  );

  const avvisGodkjenning = useCallback(
    (bilagId: string, kjede: Godkjenningskjede, trinn: "attestasjon" | "anvisning", merknad?: string) =>
      gjørGodkjenning(bilagId, kjede, trinn, "avvist", merknad),
    [gjørGodkjenning]
  );

  return { startGodkjenning, attester, anvis, avvisGodkjenning };
}
