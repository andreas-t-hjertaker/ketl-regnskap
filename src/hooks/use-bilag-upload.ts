"use client";

import { useState, useCallback } from "react";
import { uploadFileWithProgress } from "@/lib/firebase/storage";
import { addDocument, updateDocument, nestebilagsnummer } from "@/lib/firebase/firestore";
import { loggHandling } from "@/lib/audit";
import { showToast } from "@/lib/toast";

const TILLATTE_TYPER = ["application/pdf", "image/jpeg", "image/png", "image/heic", "image/heif"];
const MAKS_STORRELSE_MB = 10;

export function useBilagUpload(uid: string | null, klientId?: string | null) {
  const [lasterOpp, setLasterOpp] = useState(false);
  const [fremdrift, setFremdrift] = useState(0);

  const uploadFil = useCallback(
    async (fil: File, bilagId?: string): Promise<string | null> => {
      if (!uid) return null;

      // Validering
      if (!TILLATTE_TYPER.includes(fil.type)) {
        showToast.error("Filtype ikke støttet. Bruk PDF, JPG, PNG eller HEIC.");
        return null;
      }
      if (fil.size > MAKS_STORRELSE_MB * 1024 * 1024) {
        showToast.error(`Filen er for stor. Maks ${MAKS_STORRELSE_MB} MB.`);
        return null;
      }

      setLasterOpp(true);
      setFremdrift(0);

      try {
        const targetBilagId = bilagId ?? crypto.randomUUID();
        const storagePath = `users/${uid}/bilag/${targetBilagId}/${fil.name}`;

        const { url } = await uploadFileWithProgress(storagePath, fil, (pct) => {
          setFremdrift(Math.round(pct));
        });

        if (bilagId) {
          // Oppdater eksisterende bilag med vedlegg-URL
          await updateDocument(`users/${uid}/bilag`, bilagId, { vedleggUrl: url });
          await loggHandling(uid, "fil_lastet_opp", "fil", bilagId, { filnavn: fil.name, url });
          showToast.success(`Fil lastet opp og koblet til bilag.`);
        } else {
          // Hent neste bilagsnummer via atomisk transaksjon
          const dato = new Date().toISOString().split("T")[0];
          const år = parseInt(dato.slice(0, 4), 10);
          const bilagsnr = await nestebilagsnummer(uid, år);

          // Opprett nytt bilag med "ubehandlet" status
          const ref = await addDocument(`users/${uid}/bilag`, {
            bilagsnr,
            dato,
            beskrivelse: fil.name.replace(/\.[^.]+$/, ""),
            belop: 0,
            klientId: klientId ?? "",
            status: "ubehandlet",
            vedleggUrl: url,
            posteringer: [],
          });
          await loggHandling(uid, "fil_lastet_opp", "fil", ref.id, { filnavn: fil.name, url });
          showToast.success(`Bilag #${bilagsnr} opprettet fra fil: ${fil.name}`);
        }

        return url;
      } catch {
        showToast.error("Opplasting feilet. Prøv igjen.");
        return null;
      } finally {
        setLasterOpp(false);
        setFremdrift(0);
      }
    },
    [uid, klientId]
  );

  const uploadFlere = useCallback(
    async (filer: File[]): Promise<void> => {
      for (const fil of filer) {
        await uploadFil(fil);
      }
    },
    [uploadFil]
  );

  return { uploadFil, uploadFlere, lasterOpp, fremdrift };
}
