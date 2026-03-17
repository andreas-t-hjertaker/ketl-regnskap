"use client";

import { Toaster as SonnerToaster } from "sonner";
import { useTheme } from "@/hooks/use-theme";

export function Toaster() {
  const { resolvedTheme } = useTheme();

  return (
    <SonnerToaster
      theme={resolvedTheme}
      richColors
      position="bottom-right"
      toastOptions={{
        className: "font-sans",
      }}
    />
  );
}
