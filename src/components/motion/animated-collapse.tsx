"use client";

import { motion, AnimatePresence } from "framer-motion";

interface AnimatedCollapseProps {
  /** Vis eller skjul innholdet */
  open: boolean;
  children: React.ReactNode;
  /** Varighet i sekunder */
  duration?: number;
  className?: string;
}

/**
 * AnimatedCollapse — smooth height-animasjon for innhold som vises/skjules.
 *
 * Løser det notorisk vanskelige "animate to auto height"-problemet.
 *
 * Bruk:
 *   const [open, setOpen] = useState(false);
 *   <button onClick={() => setOpen(!open)}>Toggle</button>
 *   <AnimatedCollapse open={open}>
 *     <p>Innhold som ekspanderer/kollapser</p>
 *   </AnimatedCollapse>
 */
export function AnimatedCollapse({
  open,
  children,
  duration = 0.3,
  className,
}: AnimatedCollapseProps) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{
            height: "auto",
            opacity: 1,
            transition: {
              height: { duration, ease: [0.25, 0.1, 0.25, 1] },
              opacity: { duration: duration * 0.7, delay: duration * 0.15 },
            },
          }}
          exit={{
            height: 0,
            opacity: 0,
            transition: {
              height: { duration: duration * 0.8, ease: [0.25, 0.1, 0.25, 1] },
              opacity: { duration: duration * 0.4 },
            },
          }}
          className={className}
          style={{ overflow: "hidden" }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
