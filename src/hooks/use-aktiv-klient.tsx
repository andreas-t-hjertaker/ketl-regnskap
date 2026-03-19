"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { KlientMedId } from "@/hooks/use-klienter";

const STORAGE_KEY = "ketl_aktiv_klient_id";

type AktivKlientContextType = {
  aktivKlient: KlientMedId | null;
  aktivKlientId: string | null;
  setAktivKlient: (klient: KlientMedId | null) => void;
  visAlleKlienter: boolean;
};

export const AktivKlientContext = createContext<AktivKlientContextType | null>(null);

export function useAktivKlient(): AktivKlientContextType {
  const ctx = useContext(AktivKlientContext);
  if (!ctx) {
    throw new Error("useAktivKlient må brukes innenfor en AktivKlientProvider");
  }
  return ctx;
}

export function AktivKlientProvider({
  children,
  klienter,
}: {
  children: ReactNode;
  klienter: KlientMedId[];
}) {
  const [aktivKlientId, setAktivKlientId] = useState<string | null>(null);

  // Les fra localStorage ved oppstart
  useEffect(() => {
    const stored = typeof window !== "undefined"
      ? localStorage.getItem(STORAGE_KEY)
      : null;
    if (stored) setAktivKlientId(stored);
  }, []);

  const aktivKlient = klienter.find((k) => k.id === aktivKlientId) ?? null;
  const visAlleKlienter = aktivKlientId === null || aktivKlient === null;

  const setAktivKlient = useCallback((klient: KlientMedId | null) => {
    const id = klient?.id ?? null;
    setAktivKlientId(id);
    if (typeof window !== "undefined") {
      if (id) {
        localStorage.setItem(STORAGE_KEY, id);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  return (
    <AktivKlientContext.Provider
      value={{ aktivKlient, aktivKlientId, setAktivKlient, visAlleKlienter }}
    >
      {children}
    </AktivKlientContext.Provider>
  );
}
