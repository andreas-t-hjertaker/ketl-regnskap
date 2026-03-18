"use client";

import { useRef } from "react";
import { motion, useInView, type UseInViewOptions } from "framer-motion";

type Direction = "up" | "down" | "left" | "right";

interface ScrollRevealProps {
  children: React.ReactNode;
  /** Retning å animere fra */
  direction?: Direction;
  /** Forsinkelse */
  delay?: number;
  /** Varighet */
  duration?: number;
  /** Offset i px */
  offset?: number;
  /** Threshold-margin for IntersectionObserver */
  margin?: UseInViewOptions["margin"];
  /** Animer kun én gang */
  once?: boolean;
  className?: string;
}

/**
 * ScrollReveal — elementer som animeres inn når de scroller inn i viewport.
 *
 * Perfekt for landingssider, feature-seksjoner, testimonials.
 *
 * Bruk:
 *   <ScrollReveal direction="up" delay={0.1}>
 *     <FeatureCard />
 *   </ScrollReveal>
 */
export function ScrollReveal({
  children,
  direction = "up",
  delay = 0,
  duration = 0.5,
  offset = 30,
  margin = "-60px 0px -60px 0px",
  once = true,
  className,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once, margin });

  const axis = direction === "up" || direction === "down" ? "y" : "x";
  const sign = direction === "up" || direction === "left" ? offset : -offset;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, [axis]: sign }}
      animate={
        isInView
          ? { opacity: 1, [axis]: 0 }
          : { opacity: 0, [axis]: sign }
      }
      transition={{
        duration,
        delay,
        ease: [0.25, 0.1, 0.25, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
