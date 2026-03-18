"use client";

import { motion } from "framer-motion";

interface StaggerListProps {
  children: React.ReactNode;
  /** Forsinkelse mellom hvert barn (sekunder) */
  staggerDelay?: number;
  /** Forsinkelse før sekvensen starter */
  initialDelay?: number;
  className?: string;
}

/**
 * StaggerList — container som animerer barn sekvensielt.
 *
 * Bruk sammen med <StaggerItem>:
 *   <StaggerList>
 *     {items.map(i => <StaggerItem key={i.id}>...</StaggerItem>)}
 *   </StaggerList>
 */
export function StaggerList({
  children,
  staggerDelay = 0.06,
  initialDelay = 0.04,
  className,
}: StaggerListProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: staggerDelay,
            delayChildren: initialDelay,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface StaggerItemProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * StaggerItem — barn i en StaggerList.
 *
 * Fader inn og skyves opp.
 */
export function StaggerItem({ children, className }: StaggerItemProps) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 12 },
        visible: {
          opacity: 1,
          y: 0,
          transition: {
            duration: 0.35,
            ease: [0.25, 0.1, 0.25, 1],
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
