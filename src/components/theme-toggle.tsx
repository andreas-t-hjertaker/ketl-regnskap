"use client";

import { useTheme, type Theme } from "@/hooks/use-theme";
import { Button } from "@/components/ui/button";
import { Sun, Moon, Monitor } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const cycle: Theme[] = ["light", "dark", "system"];
const labels: Record<Theme, string> = {
  light: "Lyst tema",
  dark: "Mørkt tema",
  system: "System-tema",
};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  function next() {
    const idx = cycle.indexOf(theme);
    setTheme(cycle[(idx + 1) % cycle.length]);
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button variant="ghost" size="icon" onClick={next} />}
      >
        {theme === "light" && <Sun className="h-4 w-4" />}
        {theme === "dark" && <Moon className="h-4 w-4" />}
        {theme === "system" && <Monitor className="h-4 w-4" />}
      </TooltipTrigger>
      <TooltipContent>{labels[theme]}</TooltipContent>
    </Tooltip>
  );
}
