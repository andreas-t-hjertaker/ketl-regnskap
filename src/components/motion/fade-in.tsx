"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

type Direction = "up" | "down" | "left" | "right";

interface FadeInProps extends Omit<HTMLMotionProps<"div">, "children"> {
  children: React.ReactNode;
  /** Forsinkelse i sekunder */
  delay?: number;
  /** Varighet i sekunder */
  duration?: number;
  className?: string;
}

/**
 * FadeIn — enkel fade med opacity.
 */
export function FadeIn({
  children,
  delay = 0,
  duration = 0.4,
  className,
  ...props
}: FadeInProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration, delay, ease: [0.25, 0.1, 0.25, 1] }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

interface SlideInProps extends FadeInProps {
  /** Retning å slide fra */
  direction?: Direction;
  /** Slide-avstand i px */
  offset?: number;
}

/**
 * SlideIn — fade + slide fra valgt retning.
 *
 * Bruk: <SlideIn direction="up" delay={0.1}>Innhold</SlideIn>
 */
export function SlideIn({
  children,
  direction = "up",
  delay = 0,
  duration = 0.45,
  offset = 20,
  className,
  ...props
}: SlideInProps) {
  const axis = direction === "up" || direction === "down" ? "y" : "x";
  const sign =
    direction === "up" || direction === "left" ? offset : -offset;

  return (
    <motion.div
      initial={{ opacity: 0, [axis]: sign }}
      animate={{ opacity: 1, [axis]: 0 }}
      transition={{
        duration,
        delay,
        ease: [0.25, 0.1, 0.25, 1],
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * ScaleIn — fade + scale fra center.
 */
export function ScaleIn({
  children,
  delay = 0,
  duration = 0.35,
  className,
  ...props
}: FadeInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration,
        delay,
        ease: [0.25, 0.1, 0.25, 1],
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * BlurIn — fade + blur for tekst og hero-elementer.
 */
export function BlurIn({
  children,
  delay = 0,
  duration = 0.6,
  className,
  ...props
}: FadeInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, filter: "blur(8px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      transition={{
        duration,
        delay,
        ease: [0.25, 0.1, 0.25, 1],
      }}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}
