/**
 * Animasjons-presets — spring-konfigurasjoner og varianter
 *
 * Brukes av alle motion-komponenter for konsistent bevegelse.
 */

import type { Transition, Variants } from "framer-motion";

/** Spring-presets for ulik "feel" */
export const springPresets = {
  /** Rask og responsiv — knapper, toggles */
  snappy: { type: "spring", stiffness: 500, damping: 30 } as Transition,
  /** Naturlig og behagelig — kort, paneler */
  gentle: { type: "spring", stiffness: 260, damping: 25 } as Transition,
  /** Treg og elegant — side-overganger, modale */
  smooth: { type: "spring", stiffness: 180, damping: 22 } as Transition,
  /** Bouncey — kun for playful elementer */
  bounce: { type: "spring", stiffness: 400, damping: 15 } as Transition,
} as const;

/** Fade inn/ut */
export const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

/** Slide inn fra retning */
export const slideVariants = {
  up: {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
  } as Variants,
  down: {
    hidden: { opacity: 0, y: -16 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 8 },
  } as Variants,
  left: {
    hidden: { opacity: 0, x: 16 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -8 },
  } as Variants,
  right: {
    hidden: { opacity: 0, x: -16 },
    visible: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 8 },
  } as Variants,
};

/** Scale inn/ut */
export const scaleVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

/** Stagger-container: barn animeres sekvensielt */
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.04,
    },
  },
};

/** Stagger-barn */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] },
  },
};
