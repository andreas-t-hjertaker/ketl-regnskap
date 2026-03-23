"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./use-auth";
import { fetchApi } from "@/lib/api-client";

export type Note = {
  id: string;
  title: string;
  content: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
};

export function useNotes() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotes = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    const res = await fetchApi<Note[]>("/notes");
    if (res.success) {
      setNotes(res.data);
    }
    setLoading(false);
  }, [user?.uid]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  async function createNote(title: string, content: string): Promise<Note | null> {
    const res = await fetchApi<Note>("/notes", {
      method: "POST",
      body: { title, content },
    });
    if (res.success) {
      setNotes((prev) => [res.data, ...prev]);
      return res.data;
    }
    return null;
  }

  async function updateNote(id: string, title: string, content: string): Promise<boolean> {
    const res = await fetchApi<Note>(`/notes/${id}`, {
      method: "PATCH",
      body: { title, content },
    });
    if (res.success) {
      setNotes((prev) => prev.map((n) => n.id === id ? res.data : n));
      return true;
    }
    return false;
  }

  async function deleteNote(id: string): Promise<boolean> {
    const res = await fetchApi<{ deleted: boolean }>(`/notes/${id}`, {
      method: "DELETE",
    });
    if (res.success) {
      setNotes((prev) => prev.filter((n) => n.id !== id));
      return true;
    }
    return false;
  }

  return { notes, loading, createNote, updateNote, deleteNote, refetch: fetchNotes };
}
