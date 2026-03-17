"use client";

import { useEffect, useState } from "react";
import { onSnapshot, query, orderBy, collection } from "firebase/firestore";
import { db, addDocument, deleteDocument } from "@/lib/firebase";
import { trackEvent } from "@/lib/firebase/analytics";

type Note = {
  id: string;
  text: string;
  createdAt: { seconds: number } | null;
};

export default function Home() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"connecting" | "connected" | "error">(
    "connecting"
  );

  useEffect(() => {
    const q = query(collection(db, "notes"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setStatus("connected");
        setNotes(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Note));
      },
      () => setStatus("error")
    );
    return unsub;
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");
    await addDocument("notes", { text });
    trackEvent("note_added", { length: text.length });
  }

  async function handleDelete(id: string) {
    await deleteDocument("notes", id);
    trackEvent("note_deleted");
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <header className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight">ketlcloud</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Next.js + Firebase grunnmur
        </p>
      </header>

      <form onSubmit={handleSubmit} className="mb-8 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Skriv et notat..."
          className="flex-1 rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none transition-colors placeholder:text-neutral-600 focus:border-neutral-600"
        />
        <button
          type="submit"
          className="rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-950 transition-opacity hover:opacity-80"
        >
          Legg til
        </button>
      </form>

      <ul className="space-y-0 divide-y divide-neutral-800/50">
        {notes.map((note) => (
          <li key={note.id} className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <span className="text-sm">{note.text}</span>
              {note.createdAt && (
                <span className="text-xs text-neutral-600">
                  {new Date(note.createdAt.seconds * 1000).toLocaleTimeString(
                    "no-NO",
                    { hour: "2-digit", minute: "2-digit" }
                  )}
                </span>
              )}
            </div>
            <button
              onClick={() => handleDelete(note.id)}
              className="text-xs text-neutral-600 transition-colors hover:text-red-400"
            >
              slett
            </button>
          </li>
        ))}
      </ul>

      {notes.length === 0 && status === "connected" && (
        <p className="text-center text-sm text-neutral-600">
          Ingen notater ennå
        </p>
      )}

      <footer className="mt-12 text-xs text-neutral-700">
        Firestore:{" "}
        <span
          className={
            status === "connected"
              ? "text-green-600"
              : status === "error"
                ? "text-red-500"
                : "text-neutral-500"
          }
        >
          {status}
        </span>
      </footer>
    </div>
  );
}
