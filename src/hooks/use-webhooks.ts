"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./use-auth";
import { fetchApi } from "@/lib/api-client";
import type { WebhookHendelse } from "@/types";

export type WebhookListItem = {
  id: string;
  url: string;
  hendelser: WebhookHendelse[];
  aktiv: boolean;
  opprettet: string;
};

export type WebhookLoggItem = {
  id: string;
  webhookId: string;
  hendelse: WebhookHendelse;
  statusKode: number;
  forsøk: number;
  url: string;
  tidspunkt: string;
  ok: boolean;
};

export function useWebhooks() {
  const { user } = useAuth();
  const [webhooks, setWebhooks] = useState<WebhookListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWebhooks = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    const res = await fetchApi<WebhookListItem[]>("/webhooks");
    if (res.success) {
      setWebhooks(res.data);
    }
    setLoading(false);
  }, [user?.uid]);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  async function createWebhook(
    url: string,
    hendelser: WebhookHendelse[]
  ): Promise<boolean> {
    const res = await fetchApi<{ id: string; secret: string; webhook: WebhookListItem }>(
      "/webhooks",
      { method: "POST", body: { url, hendelser } }
    );
    if (res.success) {
      setWebhooks((prev) => [res.data.webhook, ...prev]);
      return true;
    }
    return false;
  }

  async function deleteWebhook(id: string): Promise<boolean> {
    const res = await fetchApi<{ deleted: boolean }>(`/webhooks/${id}`, {
      method: "DELETE",
    });
    if (res.success && res.data.deleted) {
      setWebhooks((prev) => prev.filter((w) => w.id !== id));
      return true;
    }
    return false;
  }

  async function fetchLogg(webhookId: string): Promise<WebhookLoggItem[]> {
    const res = await fetchApi<WebhookLoggItem[]>(`/webhooks/${webhookId}/logg`);
    return res.success ? res.data : [];
  }

  return { webhooks, loading, createWebhook, deleteWebhook, fetchLogg, refetch: fetchWebhooks };
}
