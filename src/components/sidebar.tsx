"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  Receipt,
  Building2,
  BarChart3,
  Settings,
  PanelLeftClose,
  PanelLeft,
  Menu,
  CreditCard,
  Code,
  Shield,
  ChevronDown,
  Users,
  BookOpenCheck,
  BookMarked,
  StickyNote,
} from "lucide-react";
import { useAdmin } from "@/hooks/use-admin";
import { useAktivKlient } from "@/hooks/use-aktiv-klient";
import { useKlienter } from "@/hooks/use-klienter";
import { useAuth } from "@/hooks/use-auth";

const navItems = [
  { href: "/dashboard", label: "Oversikt", icon: LayoutDashboard },
  { href: "/dashboard/bilag", label: "Bilag", icon: Receipt },
  { href: "/dashboard/klienter", label: "Klienter", icon: Building2 },
  { href: "/dashboard/motparter", label: "Motparter", icon: Users },
  { href: "/dashboard/rapporter", label: "Rapporter", icon: BarChart3 },
  { href: "/dashboard/aarsoppgjor", label: "Årsoppgjør", icon: BookOpenCheck },
  { href: "/dashboard/kontoplan", label: "Kontoplan", icon: BookMarked },
  { href: "/dashboard/notater", label: "Notater", icon: StickyNote },
  { href: "/dashboard/abonnement", label: "Abonnement", icon: CreditCard },
  { href: "/dashboard/utvikler", label: "Utvikler", icon: Code },
  { href: "/dashboard/innstillinger", label: "Innstillinger", icon: Settings },
];

function KlientVelger({ collapsed }: { collapsed?: boolean }) {
  const { user } = useAuth();
  const { klienter } = useKlienter(user?.uid ?? null);
  const { aktivKlient, setAktivKlient, visAlleKlienter } = useAktivKlient();
  const [søk, setSøk] = useState("");

  const filtrerte = klienter.filter((k) =>
    k.navn.toLowerCase().includes(søk.toLowerCase()) ||
    k.orgnr.includes(søk)
  );

  if (collapsed) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger className="w-full flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-accent/50 hover:text-foreground" title={aktivKlient?.navn ?? "Alle klienter"}>
            <Users className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" className="w-48">
          <DropdownMenuItem onClick={() => setAktivKlient(null)}>
            Alle klienter
          </DropdownMenuItem>
          {klienter.slice(0, 8).map((k) => (
            <DropdownMenuItem key={k.id} onClick={() => setAktivKlient(k)}>
              {k.navn}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-normal hover:bg-accent/50">
          <div className="flex items-center gap-2 min-w-0">
            <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-left">
              {visAlleKlienter ? "Alle klienter" : aktivKlient?.navn}
            </span>
          </div>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        <div className="px-2 py-1.5">
          <input
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
            placeholder="Søk etter klient…"
            value={søk}
            onChange={(e) => setSøk(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => { setAktivKlient(null); setSøk(""); }}>
          <span className="font-medium">Alle klienter</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {filtrerte.length === 0 ? (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">Ingen treff</p>
        ) : (
          filtrerte.slice(0, 10).map((k) => (
            <DropdownMenuItem
              key={k.id}
              onClick={() => { setAktivKlient(k); setSøk(""); }}
              className={cn(aktivKlient?.id === k.id && "bg-accent")}
            >
              <div className="min-w-0">
                <p className="truncate">{k.navn}</p>
                <p className="font-mono text-xs text-muted-foreground">{k.orgnr}</p>
              </div>
            </DropdownMenuItem>
          ))
        )}
        {klienter.length === 0 && (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">
            Ingen klienter ennå.{" "}
            <Link href="/dashboard/klienter" className="text-primary hover:underline">
              Legg til →
            </Link>
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NavLinks({ onClick }: { onClick?: () => void }) {
  const pathname = usePathname();
  const { isAdmin } = useAdmin();

  const allItems = isAdmin
    ? [...navItems, { href: "/admin", label: "Admin", icon: Shield }]
    : navItems;

  return (
    <nav className="space-y-1">
      {allItems.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/dashboard" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClick}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200",
              isActive
                ? "bg-accent text-accent-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground hover:translate-x-0.5"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Sidebar for desktop med kollaps-mulighet */
export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "hidden h-screen flex-col border-r border-border bg-sidebar transition-all duration-200 md:flex",
        collapsed ? "w-16" : "w-60"
      )}
    >
      <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-3">
        {!collapsed && (
          <Link
            href="/dashboard"
            className="flex items-center gap-2 font-semibold tracking-tight"
          >
            <Receipt className="h-5 w-5" />
            <span>ketl regnskap</span>
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className={cn(collapsed && "mx-auto")}
        >
          {collapsed ? (
            <PanelLeft className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Klientvelger */}
      <div className={cn("border-b border-sidebar-border", collapsed ? "px-2 py-2" : "px-2 py-2")}>
        <KlientVelger collapsed={collapsed} />
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {collapsed ? <CollapsedNav /> : <NavLinks />}
      </div>
    </aside>
  );
}

/** Kollapset navigasjon — bare ikoner */
function CollapsedNav() {
  const pathname = usePathname();
  const { isAdmin } = useAdmin();

  const allItems = isAdmin
    ? [...navItems, { href: "/admin", label: "Admin", icon: Shield }]
    : navItems;

  return (
    <nav className="space-y-1">
      {allItems.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/dashboard" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center justify-center rounded-lg p-2 transition-colors",
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
            title={item.label}
          >
            <item.icon className="h-4 w-4" />
          </Link>
        );
      })}
    </nav>
  );
}

/** Mobil-sidebar som Sheet/drawer */
export function MobileSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="ghost" size="icon" className="md:hidden" />}
      >
        <Menu className="h-5 w-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-60 p-0">
        <SheetTitle className="sr-only">Navigasjon</SheetTitle>
        <div className="flex h-14 items-center border-b border-sidebar-border px-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 font-semibold tracking-tight"
            onClick={() => setOpen(false)}
          >
            <Receipt className="h-5 w-5" />
            <span>ketl regnskap</span>
          </Link>
        </div>
        <div className="border-b border-sidebar-border px-2 py-2">
          <KlientVelger />
        </div>
        <div className="p-3">
          <NavLinks onClick={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
