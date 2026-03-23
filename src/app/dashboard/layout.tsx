"use client";

import { ProtectedRoute } from "@/components/protected-route";
import { Sidebar, MobileSidebar } from "@/components/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { useKlienter } from "@/hooks/use-klienter";
import { AktivKlientProvider } from "@/hooks/use-aktiv-klient";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { AiAssistant } from "@/modules/ai-assistant";
import { OnboardingStepper } from "@/components/onboarding-stepper";
import { PageTransition } from "@/components/motion";
import { OfflineBanner } from "@/components/offline-banner";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { ErrorBoundary } from "@/components/error-boundary";

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const { klienter } = useKlienter(user?.uid ?? null);

  // Lag initialer fra visningsnavn eller e-post
  const initials = user?.displayName?.trim()
    ? user.displayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.charAt(0).toUpperCase() || "?";

  return (
    <AktivKlientProvider klienter={klienter}>
      <OfflineBanner />
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Topplinje */}
          <header className="flex h-14 items-center justify-between border-b border-border px-4">
            <MobileSidebar />
            <div className="ml-auto flex items-center gap-3">
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {user?.displayName || user?.email}
              </span>
              <ThemeToggle />
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full"
                    />
                  }
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage
                      src={user?.photoURL || undefined}
                      alt={user?.displayName || "Bruker"}
                    />
                    <AvatarFallback className="text-xs">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={signOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Logg ut
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Hovedinnhold */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-20 md:pb-6">
            <ErrorBoundary>
              <PageTransition>{children}</PageTransition>
            </ErrorBoundary>
          </main>
        </div>
        <AiAssistant
          title="ketl regnskapsassistent"
          welcomeMessage="Hei! Jeg er din AI-regnskapsassistent. Spør meg om bilagsregistrering, kontoplan, MVA, lønn, periodeavslutning eller hva du ellers lurer på!"
          contextProvider={() => ({
            user: user
              ? { displayName: user.displayName, email: user.email, uid: user.uid }
              : undefined,
            appName: "ketl regnskap",
            currentPath: typeof window !== "undefined" ? window.location.pathname : "/dashboard",
            customContext: [
              "Tilgjengelige moduler i ketl regnskap:",
              "- Bilag: registrere og bokføre inngående/utgående bilag med AI-forslag",
              "- Faktura: opprette og sende utgående fakturaer (FF-YYYY-NNNNN), inkl. purring og bokføring",
              "- Klienter: administrere regnskapsklienter med orgnr, kontakt og faktura-innstillinger",
              "- Motparter: leverandører og kunder med BRREG-oppslag",
              "- Rapporter: resultatregnskap, balanse, MVA-rapport, SAF-T-eksport, kontantstrøm",
              "- Budsjett: sammenligne faktiske tall mot budsjett per konto",
              "- Prosjekter: koble bilag til prosjekter og følge prosjektresultat",
              "- Bankavst.: importere banktransaksjoner (CSV) og matche mot bilag",
              "- A-melding: lønn, arbeidsgiveravgift og lønnsseddel",
              "- Avskrivninger: saldoavskrivning og linære avskrivningsplaner",
              "- Kontoplan: norsk kontoplan NS 4102 med MVA-koder",
              "- Årsoppgjør: fullstendig årsregnskap med SAF-T og CSV-eksport",
              "- Revisjonslogg: sporing av alle handlinger",
            ].join("\n"),
          })}
        />
        <OnboardingStepper />
        <MobileBottomNav />
      </div>
    </AktivKlientProvider>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <DashboardContent>{children}</DashboardContent>
    </ProtectedRoute>
  );
}
