"use client";

import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  reauthenticateWithCredential,
  EmailAuthProvider,
  updatePassword,
  updateProfile,
  linkWithPopup,
  unlink,
  GoogleAuthProvider,
  multiFactor,
  TotpMultiFactorGenerator,
  type TotpSecret,
} from "firebase/auth";
import { useAuth } from "@/hooks/use-auth";
import { uploadFile } from "@/lib/firebase/storage";
import { apiDelete } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { showToast } from "@/lib/toast";
import { Loader2, Upload, Lock, Link2, Unlink, Trash2, ShieldCheck, ShieldOff, KeyRound } from "lucide-react";

// ─── Profil-skjema ──────────────────────────────────────────
const profileSchema = z.object({
  displayName: z
    .string()
    .min(2, "Navnet må være minst 2 tegn")
    .max(50, "Navnet kan ikke være lengre enn 50 tegn"),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

// ─── Passord-skjema ─────────────────────────────────────────
const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Nåværende passord er påkrevd"),
    newPassword: z.string().min(6, "Nytt passord må være minst 6 tegn"),
    confirmPassword: z.string().min(1, "Bekreft passord er påkrevd"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passordene stemmer ikke overens",
    path: ["confirmPassword"],
  });

type PasswordFormValues = z.infer<typeof passwordSchema>;

export default function InnstillingerPage() {
  const { user, firebaseUser } = useAuth();
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [linkingGoogle, setLinkingGoogle] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── 2FA-tilstand ───────────────────────────────────────────
  const [totpSteg, setTotpSteg] = useState<"idle" | "setup" | "verify">("idle");
  const [totpSecret, setTotpSecret] = useState<TotpSecret | null>(null);
  const [totpKode, setTotpKode] = useState("");
  const [totpNavn, setTotpNavn] = useState("Ketl Regnskap");
  const [totpLaster, setTotpLaster] = useState(false);

  const hasPasswordProvider = firebaseUser?.providerData.some(
    (p) => p.providerId === "password"
  );
  const hasGoogleProvider = firebaseUser?.providerData.some(
    (p) => p.providerId === "google.com"
  );

  const mfaInfo = firebaseUser ? multiFactor(firebaseUser).enrolledFactors : [];
  const harTotp = mfaInfo.some((f) => f.factorId === "totp");

  // ─── Profil ─────────────────────────────────────────────
  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: user?.displayName || "",
    },
  });

  async function onProfileSubmit(data: ProfileFormValues) {
    if (!firebaseUser) return;
    try {
      await updateProfile(firebaseUser, { displayName: data.displayName });
      showToast.success("Profil oppdatert");
    } catch {
      showToast.error("Kunne ikke oppdatere profil");
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !firebaseUser) return;

    if (!file.type.startsWith("image/")) {
      showToast.error("Kun bildefiler er tillatt");
      return;
    }

    setAvatarUploading(true);
    try {
      const { url } = await uploadFile(`avatars/${firebaseUser.uid}`, file);
      await updateProfile(firebaseUser, { photoURL: url });
      showToast.success("Profilbilde oppdatert");
    } catch {
      showToast.error("Kunne ikke laste opp bilde");
    }
    setAvatarUploading(false);
  }

  // ─── Passord ────────────────────────────────────────────
  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  async function onPasswordSubmit(data: PasswordFormValues) {
    if (!firebaseUser || !firebaseUser.email) return;
    try {
      const credential = EmailAuthProvider.credential(
        firebaseUser.email,
        data.currentPassword
      );
      await reauthenticateWithCredential(firebaseUser, credential);
      await updatePassword(firebaseUser, data.newPassword);
      passwordForm.reset();
      showToast.success("Passord endret");
    } catch {
      showToast.error("Feil passord eller noe gikk galt");
    }
  }

  // ─── Google-kobling ─────────────────────────────────────
  async function handleLinkGoogle() {
    if (!firebaseUser) return;
    setLinkingGoogle(true);
    try {
      await linkWithPopup(firebaseUser, new GoogleAuthProvider());
      showToast.success("Google-konto koblet til");
    } catch {
      showToast.error("Kunne ikke koble til Google");
    }
    setLinkingGoogle(false);
  }

  async function handleUnlinkGoogle() {
    if (!firebaseUser) return;
    if (firebaseUser.providerData.length <= 1) {
      showToast.error("Du må ha minst én innloggingsmetode");
      return;
    }
    setLinkingGoogle(true);
    try {
      await unlink(firebaseUser, "google.com");
      showToast.success("Google-konto frakoblet");
    } catch {
      showToast.error("Kunne ikke frakoble Google");
    }
    setLinkingGoogle(false);
  }

  // ─── Slett konto ────────────────────────────────────────
  async function handleDeleteAccount() {
    if (deleteConfirm !== "SLETT" || !firebaseUser) return;
    setDeleting(true);
    try {
      // Cloud Function sletter all Firestore-data og Auth-kontoen via Admin SDK
      await apiDelete("/account");
      showToast.success("Kontoen din er slettet");
    } catch {
      showToast.error(
        "Kunne ikke slette konto. Prøv igjen eller kontakt support."
      );
    }
    setDeleting(false);
  }

  // ─── 2FA-funksjoner ─────────────────────────────────────────
  async function startTotpSetup() {
    if (!firebaseUser) return;
    setTotpLaster(true);
    try {
      const session = await multiFactor(firebaseUser).getSession();
      const secret = await TotpMultiFactorGenerator.generateSecret(session);
      setTotpSecret(secret);
      setTotpSteg("setup");
    } catch {
      showToast.error("Kunne ikke starte 2FA-oppsett");
    }
    setTotpLaster(false);
  }

  async function bekreftTotp() {
    if (!firebaseUser || !totpSecret || totpKode.length !== 6) return;
    setTotpLaster(true);
    try {
      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(
        totpSecret,
        totpKode
      );
      await multiFactor(firebaseUser).enroll(assertion, totpNavn);
      showToast.success("Tofaktorautentisering aktivert!");
      setTotpSteg("idle");
      setTotpSecret(null);
      setTotpKode("");
    } catch {
      showToast.error("Ugyldig kode. Prøv igjen.");
    }
    setTotpLaster(false);
  }

  async function deaktiverTotp() {
    if (!firebaseUser) return;
    const faktor = mfaInfo.find((f) => f.factorId === "totp");
    if (!faktor) return;
    setTotpLaster(true);
    try {
      await multiFactor(firebaseUser).unenroll(faktor);
      showToast.success("Tofaktorautentisering deaktivert");
    } catch {
      showToast.error("Kunne ikke deaktivere 2FA. Re-autentiser og prøv igjen.");
    }
    setTotpLaster(false);
  }

  function totpQrUrl() {
    if (!totpSecret || !firebaseUser?.email) return "";
    return totpSecret.generateQrCodeUrl(
      firebaseUser.email,
      totpNavn
    );
  }

  const initials = user?.displayName
    ? user.displayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.charAt(0).toUpperCase() || "?";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Innstillinger</h1>
        <p className="text-muted-foreground">
          Administrer profil, sikkerhet og kontoinnstillinger.
        </p>
      </div>

      {/* Profil-kort */}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Profil</CardTitle>
          <CardDescription>
            Oppdater visningsnavn og profilbilde.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage
                src={firebaseUser?.photoURL || undefined}
                alt={user?.displayName || "Bruker"}
              />
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
              >
                {avatarUploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Last opp bilde
              </Button>
            </div>
          </div>

          <Form {...profileForm}>
            <form
              onSubmit={profileForm.handleSubmit(onProfileSubmit)}
              className="space-y-4"
            >
              <FormField
                control={profileForm.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Visningsnavn</FormLabel>
                    <FormControl>
                      <Input placeholder="Ditt navn" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <label className="text-sm font-medium">E-post</label>
                <Input value={user?.email || ""} disabled />
              </div>

              <Button
                type="submit"
                disabled={profileForm.formState.isSubmitting}
              >
                {profileForm.formState.isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Lagre profil
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Sikkerhet-kort */}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Sikkerhet</CardTitle>
          <CardDescription>
            Administrer passord og tilkoblede kontoer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {hasPasswordProvider && (
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <Lock className="h-4 w-4" />
                Endre passord
              </h3>
              <Form {...passwordForm}>
                <form
                  onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={passwordForm.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nåværende passord</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={passwordForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nytt passord</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={passwordForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bekreft nytt passord</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    disabled={passwordForm.formState.isSubmitting}
                  >
                    {passwordForm.formState.isSubmitting && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Endre passord
                  </Button>
                </form>
              </Form>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-sm font-medium">Tilkoblede kontoer</h3>
            <div className="space-y-2">
              {firebaseUser?.providerData.map((provider) => (
                <div
                  key={provider.providerId}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{provider.providerId}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {provider.email || "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {hasGoogleProvider ? (
              <Button
                variant="outline"
                onClick={handleUnlinkGoogle}
                disabled={linkingGoogle}
              >
                {linkingGoogle ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Unlink className="mr-2 h-4 w-4" />
                )}
                Frakoble Google
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={handleLinkGoogle}
                disabled={linkingGoogle}
              >
                {linkingGoogle ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Link2 className="mr-2 h-4 w-4" />
                )}
                Koble til Google
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 2FA-kort */}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Tofaktorautentisering (2FA)
          </CardTitle>
          <CardDescription>
            Beskytt kontoen din med en ekstra verifiseringskode via en autentiseringsapp
            (Google Authenticator, Aegis, Authy o.l.).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {harTotp ? (
            // ── Aktivert ──
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border border-green-300 bg-green-50 dark:bg-green-950/20 dark:border-green-800 p-3">
                <ShieldCheck className="h-5 w-5 text-green-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-700 dark:text-green-400">
                    2FA er aktivert
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-500">
                    Kontoen din er beskyttet med TOTP-autentisering.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={deaktiverTotp}
                disabled={totpLaster}
                className="text-destructive border-destructive/40 hover:bg-destructive/10"
              >
                {totpLaster ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ShieldOff className="mr-2 h-4 w-4" />
                )}
                Deaktiver 2FA
              </Button>
            </div>
          ) : totpSteg === "idle" ? (
            // ── Ikke aktivert ──
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-800 p-3">
                <ShieldOff className="h-5 w-5 text-yellow-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                    2FA er ikke aktivert
                  </p>
                  <p className="text-xs text-yellow-600 dark:text-yellow-500">
                    Vi anbefaler sterkt å aktivere tofaktorautentisering.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={startTotpSetup}
                disabled={totpLaster}
              >
                {totpLaster ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="mr-2 h-4 w-4" />
                )}
                Aktiver 2FA
              </Button>
            </div>
          ) : totpSteg === "setup" && totpSecret ? (
            // ── Oppsett: vis QR-kode ──
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Skann QR-koden med autentiseringsappen din, eller skriv inn hemmelig nøkkel manuelt.
              </p>

              {/* QR-kode via Google Charts API (offentlig, ingen autentisering) */}
              <div className="flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://chart.googleapis.com/chart?chs=200x200&chld=M|0&cht=qr&chl=${encodeURIComponent(totpQrUrl())}`}
                  alt="QR-kode for 2FA"
                  width={200}
                  height={200}
                  className="rounded-lg border p-2 bg-white"
                />
              </div>

              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Hemmelig nøkkel (manuell innlegging):</p>
                <code className="block rounded bg-muted px-3 py-2 text-xs font-mono break-all select-all">
                  {totpSecret.secretKey}
                </code>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Navn på enheten (valgfritt)</label>
                <Input
                  value={totpNavn}
                  onChange={(e) => setTotpNavn(e.target.value)}
                  placeholder="Min autentiseringsapp"
                  className="text-sm"
                />
              </div>

              <Button
                size="sm"
                onClick={() => setTotpSteg("verify")}
              >
                <KeyRound className="mr-2 h-4 w-4" />
                Fortsett — skriv inn kode
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setTotpSteg("idle"); setTotpSecret(null); }}
              >
                Avbryt
              </Button>
            </div>
          ) : (
            // ── Verifisering: skriv inn TOTP-kode ──
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Skriv inn den 6-sifrede koden fra autentiseringsappen for å bekrefte oppsettet.
              </p>
              <Input
                value={totpKode}
                onChange={(e) => setTotpKode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="text-2xl tracking-widest text-center font-mono max-w-[180px]"
                maxLength={6}
                inputMode="numeric"
                autoComplete="one-time-code"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={bekreftTotp}
                  disabled={totpKode.length !== 6 || totpLaster}
                >
                  {totpLaster ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="mr-2 h-4 w-4" />
                  )}
                  Bekreft og aktiver
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setTotpSteg("setup")}
                >
                  Tilbake
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Faresone-kort */}
      <Card className="max-w-2xl border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Faresone</CardTitle>
          <CardDescription>
            Irreversible handlinger som påvirker kontoen din.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Sletting av kontoen din fjerner alle data permanent, inkludert
            abonnementer, API-nøkler og dokumenter. Denne handlingen kan ikke
            angres.
          </p>
          <div className="flex items-center gap-3">
            <Input
              placeholder="Skriv SLETT for å bekrefte"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              className="max-w-xs"
            />
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deleteConfirm !== "SLETT" || deleting}
            >
              {deleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Slett konto
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
