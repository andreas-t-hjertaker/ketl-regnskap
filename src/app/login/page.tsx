"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Cloud, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, signInGoogle, signInEmail, signUpEmail, resetPassword } =
    useAuth();

  const [mode, setMode] = useState<"login" | "register" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Omdiriger om allerede innlogget
  if (!loading && user) {
    router.replace("/dashboard");
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);

    try {
      if (mode === "reset") {
        await resetPassword(email);
        setMessage("E-post for tilbakestilling av passord er sendt.");
        setSubmitting(false);
        return;
      }

      if (mode === "login") {
        await signInEmail(email, password);
      } else {
        await signUpEmail(email, password);
      }
      router.replace("/dashboard");
    } catch (err: unknown) {
      const firebaseErr = err as { code?: string };
      const messages: Record<string, string> = {
        "auth/user-not-found": "Ingen bruker funnet med denne e-postadressen.",
        "auth/wrong-password": "Feil passord.",
        "auth/invalid-credential": "Ugyldig e-post eller passord.",
        "auth/email-already-in-use": "Denne e-postadressen er allerede i bruk.",
        "auth/weak-password": "Passordet må være minst 6 tegn.",
        "auth/invalid-email": "Ugyldig e-postadresse.",
        "auth/too-many-requests": "For mange forsøk. Prøv igjen senere.",
      };
      setError(
        messages[firebaseErr.code || ""] || "Noe gikk galt. Prøv igjen."
      );
      setSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setError("");
    setSubmitting(true);
    try {
      await signInGoogle();
      router.replace("/dashboard");
    } catch {
      setError("Kunne ikke logge inn med Google.");
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mb-2 flex justify-center">
            <Cloud className="h-8 w-8" />
          </div>
          <CardTitle className="text-2xl">
            {mode === "login"
              ? "Logg inn"
              : mode === "register"
                ? "Opprett konto"
                : "Tilbakestill passord"}
          </CardTitle>
          <CardDescription>
            {mode === "login"
              ? "Logg inn på ketl cloud"
              : mode === "register"
                ? "Opprett en ny konto"
                : "Vi sender deg en lenke for å tilbakestille passordet"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-post</Label>
              <Input
                id="email"
                type="email"
                placeholder="din@epost.no"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {mode !== "reset" && (
              <div className="space-y-2">
                <Label htmlFor="password">Passord</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            {message && (
              <p className="text-sm text-green-500">{message}</p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={submitting}
            >
              {submitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {mode === "login"
                ? "Logg inn"
                : mode === "register"
                  ? "Opprett konto"
                  : "Send tilbakestillingslenke"}
            </Button>
          </form>

          {mode !== "reset" && (
            <>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    eller
                  </span>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={handleGoogleSignIn}
                disabled={submitting}
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Logg inn med Google
              </Button>
            </>
          )}
        </CardContent>
        <CardFooter className="flex justify-center gap-1 text-sm">
          {mode === "login" ? (
            <>
              <span className="text-muted-foreground">Ingen konto?</span>
              <button
                type="button"
                className="text-primary underline-offset-4 hover:underline"
                onClick={() => {
                  setMode("register");
                  setError("");
                  setMessage("");
                }}
              >
                Opprett konto
              </button>
              <span className="text-muted-foreground mx-1">·</span>
              <button
                type="button"
                className="text-primary underline-offset-4 hover:underline"
                onClick={() => {
                  setMode("reset");
                  setError("");
                  setMessage("");
                }}
              >
                Glemt passord?
              </button>
            </>
          ) : (
            <>
              <span className="text-muted-foreground">Har du konto?</span>
              <button
                type="button"
                className="text-primary underline-offset-4 hover:underline"
                onClick={() => {
                  setMode("login");
                  setError("");
                  setMessage("");
                }}
              >
                Logg inn
              </button>
            </>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
