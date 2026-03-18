/**
 * Animasjonsbibliotek — gjenbrukbare motion-komponenter
 *
 * Bruk:
 *   import { FadeIn, SlideIn, AnimatedCounter, ... } from "@/components/motion";
 */

export { PageTransition } from "./page-transition";
export { FadeIn, SlideIn, ScaleIn, BlurIn } from "./fade-in";
export { StaggerList, StaggerItem } from "./stagger-list";
export { AnimatedCounter } from "./animated-counter";
export { AnimatedCard } from "./animated-card";
export { AnimatedCollapse } from "./animated-collapse";
export { ScrollReveal } from "./scroll-reveal";
export { SkeletonShimmer } from "./skeleton-shimmer";
export {
  springPresets,
  fadeVariants,
  slideVariants,
  scaleVariants,
} from "./presets";
