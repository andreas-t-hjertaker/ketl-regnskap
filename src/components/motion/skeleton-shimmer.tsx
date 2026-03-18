"use client";

import { cn } from "@/lib/utils";

interface SkeletonShimmerProps {
  className?: string;
  /** Bredde */
  width?: string;
  /** Høyde */
  height?: string;
  /** Avrunding */
  rounded?: "sm" | "md" | "lg" | "full";
}

/**
 * SkeletonShimmer — oppgradert skeleton med animert shimmer-gradient.
 *
 * Erstatter den statiske pulse-animasjonen med en mer profesjonell
 * lyseffekt som beveger seg over elementet.
 *
 * Bruk:
 *   <SkeletonShimmer className="h-8 w-32" />
 *   <SkeletonShimmer width="200px" height="24px" rounded="full" />
 */
export function SkeletonShimmer({
  className,
  width,
  height,
  rounded = "md",
}: SkeletonShimmerProps) {
  const roundedClass = {
    sm: "rounded-sm",
    md: "rounded-md",
    lg: "rounded-lg",
    full: "rounded-full",
  }[rounded];

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-muted",
        roundedClass,
        className
      )}
      style={{ width, height }}
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-foreground/5 to-transparent" />
    </div>
  );
}
