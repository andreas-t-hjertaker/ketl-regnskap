"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AnimatedCardProps {
  children: React.ReactNode;
  className?: string;
  /** Hover lift-effekt (px skygge øker) */
  hoverLift?: boolean;
  /** Hover scale */
  hoverScale?: boolean;
  /** Klikk-feedback */
  tapScale?: boolean;
  /** Forsinkelse for innfading */
  delay?: number;
}

/**
 * AnimatedCard — kort med hover/tap mikro-animasjoner.
 *
 * Legger til:
 * - Fade-in ved mount
 * - Subtle lift + skygge ved hover
 * - Scale-ned ved klikk
 *
 * Bruk:
 *   <AnimatedCard hoverLift>
 *     <CardContent>...</CardContent>
 *   </AnimatedCard>
 */
export function AnimatedCard({
  children,
  className,
  hoverLift = true,
  hoverScale = false,
  tapScale = true,
  delay = 0,
}: AnimatedCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay,
        ease: [0.25, 0.1, 0.25, 1],
      }}
      whileHover={
        hoverLift || hoverScale
          ? {
              y: hoverLift ? -2 : 0,
              scale: hoverScale ? 1.02 : 1,
              boxShadow: hoverLift
                ? "0 8px 25px -5px rgba(0,0,0,0.08), 0 4px 10px -6px rgba(0,0,0,0.04)"
                : undefined,
              transition: {
                type: "spring",
                stiffness: 400,
                damping: 25,
              },
            }
          : undefined
      }
      whileTap={
        tapScale
          ? {
              scale: 0.98,
              transition: { type: "spring", stiffness: 500, damping: 30 },
            }
          : undefined
      }
      className={cn(
        "rounded-xl bg-card text-card-foreground ring-1 ring-foreground/10 transition-[box-shadow]",
        className
      )}
    >
      {children}
    </motion.div>
  );
}
