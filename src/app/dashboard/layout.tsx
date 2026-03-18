"use client";

import { ProtectedRoute } from "@/components/protected-route";
import { Sidebar, MobileSidebar } from "@/components/sidebar";
import { useAuth } from "@/hooks/use-auth";
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

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();

  // Lag initialer fra visningsnavn eller e-post
  const initials = user?.displayName
    ? user.displayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.charAt(0).toUpperCase() || "?";

  return (
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
        <main className="flex-1 overflow-y-auto p-6">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
      <AiAssistant
        title="ketl assistent"
        welcomeMessage="Hei! Jeg er din AI-assistent. Spør meg om hva som helst!"
        contextProvider={() => ({
          user: user
            ? { displayName: user.displayName, email: user.email, uid: user.uid }
            : undefined,
          appName: "ketl cloud",
          currentPath: typeof window !== "undefined" ? window.location.pathname : "/dashboard",
          customContext:
            "Tilgjengelige tjenester: Firebase Hosting, Firestore, Cloud Storage, Cloud Functions, AI Logic, Analytics.",
        })}
      />
      <OnboardingStepper />
    </div>
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
