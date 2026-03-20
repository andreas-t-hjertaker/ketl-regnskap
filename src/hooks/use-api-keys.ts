"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./use-auth";
import { fetchApi } from "@/lib/api-client";
import type { ApiKey, ApiScope } from "@/types";

type ApiKeyListItem = Omit<ApiKey, "hashedKey">;

export function useApiKeys() {
  const { user } = useAuth();
  const [keys, setKeys] = useState<ApiKeyListItem[]>([]);
  const [loading, setLoading] = useState(true);

  /** Hent alle API-nøkler for innlogget bruker */
  const fetchKeys = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    const res = await fetchApi<ApiKeyListItem[]>("/api-keys");
    if (res.success) {
      setKeys(res.data);
    }
    setLoading(false);
  }, [user?.uid]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  /** Opprett ny API-nøkkel med spesifiserte scopes */
  async function createKey(name: string, scopes: ApiScope[]): Promise<string | null> {
    const res = await fetchApi<{ key: string; apiKey: ApiKeyListItem }>("/api-keys", {
      method: "POST",
      body: { name, scopes },
    });

    if (res.success) {
      // Legg til den nye nøkkelen i listen
      setKeys((prev) => [res.data.apiKey, ...prev]);
      return res.data.key;
    }
    return null;
  }

  /** Tilbakekall (soft delete) en API-nøkkel */
  async function revokeKey(id: string): Promise<boolean> {
    const res = await fetchApi<{ success: boolean }>(`/api-keys/${id}`, {
      method: "DELETE",
    });

    if (res.success) {
      // Oppdater listen lokalt
      setKeys((prev) =>
        prev.map((k) => (k.id === id ? { ...k, revoked: true } : k))
      );
      return true;
    }
    return false;
  }

  return { keys, loading, createKey, revokeKey, refetch: fetchKeys };
}
