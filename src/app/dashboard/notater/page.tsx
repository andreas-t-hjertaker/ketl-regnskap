"use client";

/**
 * Notater — hurtignotater og intern dokumentasjon
 *
 * Lar bruker skrive og lagre notater knyttet til regnskapsarbeidet.
 * Notater er private per bruker og lagres i Firestore via Cloud Functions.
 */

import { useState } from "react";
import { Plus, FileText, Clock, Trash2 } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { SlideIn, StaggerList, StaggerItem } from "@/components/motion";
import { useNotes } from "@/hooks/use-notes";
import { showToast } from "@/lib/toast";
import { formatDate } from "@/lib/utils";

export default function NotaterPage() {
  const { notes, loading, createNote, deleteNote } = useNotes();
  const [visSkjema, setVisSkjema] = useState(false);
  const [tittel, setTittel] = useState("");
  const [innhold, setInnhold] = useState("");
  const [lagrer, setLagrer] = useState(false);
  const [åpentNotat, setÅpentNotat] = useState<string | null>(null);

  async function handleOpprett() {
    if (!tittel.trim()) {
      showToast.error("Tittel er påkrevd.");
      return;
    }
    setLagrer(true);
    const note = await createNote(tittel.trim(), innhold.trim());
    setLagrer(false);
    if (note) {
      showToast.success("Notat lagret.");
      setTittel("");
      setInnhold("");
      setVisSkjema(false);
    } else {
      showToast.error("Klarte ikke lagre notatet.");
    }
  }

  return (
    <div className="space-y-6">
      <SlideIn direction="up" duration={0.4}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Notater</h1>
            <p className="text-muted-foreground">
              Interne notater og dokumentasjon til regnskapsarbeidet.
            </p>
          </div>
          <Button onClick={() => setVisSkjema((v) => !v)}>
            <Plus className="mr-2 h-4 w-4" />
            Nytt notat
          </Button>
        </div>
      </SlideIn>

      {/* Opprett-skjema */}
      {visSkjema && (
        <SlideIn direction="up" delay={0.05}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Nytt notat</CardTitle>
              <CardDescription>Notater er kun synlig for deg.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="tittel">Tittel *</Label>
                <Input
                  id="tittel"
                  placeholder="f.eks. Gjennomgang bilag oktober"
                  value={tittel}
                  onChange={(e) => setTittel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      document.getElementById("innhold")?.focus();
                    }
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="innhold">Innhold</Label>
                <textarea
                  id="innhold"
                  className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="Skriv notatet ditt her…"
                  value={innhold}
                  onChange={(e) => setInnhold(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setVisSkjema(false); setTittel(""); setInnhold(""); }}>
                  Avbryt
                </Button>
                <Button onClick={handleOpprett} disabled={lagrer || !tittel.trim()}>
                  {lagrer ? "Lagrer…" : "Lagre notat"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </SlideIn>
      )}

      {/* Notat-liste */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-24 mt-1" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : notes.length === 0 ? (
        <SlideIn direction="up">
          <div className="rounded-xl border border-border/40 py-16 text-center text-muted-foreground">
            <FileText className="mx-auto mb-3 h-8 w-8 opacity-40" />
            <p className="text-sm font-medium">Ingen notater ennå</p>
            <p className="text-xs mt-1">Opprett et notat for å komme i gang.</p>
          </div>
        </SlideIn>
      ) : (
        <StaggerList className="space-y-3" staggerDelay={0.05}>
          {notes.map((note) => (
            <StaggerItem key={note.id}>
              <Card
                className="cursor-pointer hover:border-primary/30 transition-colors group"
                onClick={() => setÅpentNotat(åpentNotat === note.id ? null : note.id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-semibold leading-snug">
                      {note.title}
                    </CardTitle>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDate(note.createdAt)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNote(note.id);
                        }}
                        title="Slett notat"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                {(åpentNotat === note.id || !note.content) && note.content && (
                  <CardContent>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {note.content}
                    </p>
                  </CardContent>
                )}
                {åpentNotat !== note.id && note.content && (
                  <CardContent className="pb-3">
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {note.content}
                    </p>
                  </CardContent>
                )}
              </Card>
            </StaggerItem>
          ))}
        </StaggerList>
      )}
    </div>
  );
}
