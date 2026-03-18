"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useSpring, useTransform, useInView } from "framer-motion";

interface AnimatedCounterProps {
  /** Sluttverdi å telle til */
  value: number;
  /** Varighet i sekunder */
  duration?: number;
  /** Prefix (f.eks. "kr ") */
  prefix?: string;
  /** Suffix (f.eks. "%") */
  suffix?: string;
  /** Antall desimaler */
  decimals?: number;
  /** Tusen-separator */
  separator?: string;
  className?: string;
}

/**
 * AnimatedCounter — teller fra 0 til verdi med easing.
 *
 * Brukes i KPI-kort, statistikk-oversikter, admin-panel.
 *
 * Bruk:
 *   <AnimatedCounter value={1234} prefix="kr " />
 *   <AnimatedCounter value={98.5} suffix="%" decimals={1} />
 */
export function AnimatedCounter({
  value,
  duration = 1.2,
  prefix = "",
  suffix = "",
  decimals = 0,
  separator = " ",
  className,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px 0px -40px 0px" });
  const [displayValue, setDisplayValue] = useState("0");

  const spring = useSpring(0, {
    stiffness: 60,
    damping: 20,
    duration: duration * 1000,
  });

  const rounded = useTransform(spring, (latest) => {
    const fixed = latest.toFixed(decimals);
    // Legg til tusen-separator
    const parts = fixed.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, separator);
    return `${prefix}${parts.join(",")}${suffix}`;
  });

  useEffect(() => {
    if (isInView) {
      spring.set(value);
    }
  }, [isInView, value, spring]);

  useEffect(() => {
    const unsub = rounded.on("change", (v) => setDisplayValue(v));
    return unsub;
  }, [rounded]);

  return (
    <motion.span
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 4 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.3 }}
    >
      {displayValue}
    </motion.span>
  );
}
