import { AnimatePresence, motion } from "motion/react";
import { useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";

/**
 * Project-wide route transition: zoom enter + zoom exit, duration-700.
 * Wizard-step-specific slide animations are handled inside the wizard component.
 */
export function RouteTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="flex-1"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
