"use client";

/**
 * Mobilnavigasjon — bunn-navigasjonslinje for mobil (#42)
 *
 * Viser de viktigste navigasjonslenkene som en fast bunn-bar på mobil.
 * Kun synlig under md-breakpointet.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Receipt,
  BarChart3,
  Settings,
  Plus,
} from "lucide-react";

const bottomNavItems = [
  { href: "/dashboard", label: "Hjem", icon: LayoutDashboard },
  { href: "/dashboard/bilag", label: "Bilag", icon: Receipt },
  { href: "/dashboard/bilag/ny", label: "Ny", icon: Plus, highlight: true },
  { href: "/dashboard/rapporter", label: "Rapporter", icon: BarChart3 },
  { href: "/dashboard/innstillinger", label: "Mer", icon: Settings },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
      <div className="flex items-center justify-around h-14 px-1 safe-area-bottom">
        {bottomNavItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          if (item.highlight) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center justify-center -mt-3"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
                  <item.icon className="h-5 w-5" />
                </div>
                <span className="text-[10px] mt-0.5 text-primary font-medium">
                  {item.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 min-w-[56px] py-1 rounded-md transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground active:text-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive && "stroke-[2.5px]")} />
              <span className={cn("text-[10px]", isActive && "font-medium")}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
