import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { ReactNode } from "react";

interface AnimatedPageProps {
  children: ReactNode;
  className?: string;
}

interface AnimatedItemProps extends AnimatedPageProps {
  /** Subtle lift on hover for interactive cards and sections. */
  interactive?: boolean;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
};

const itemVariants: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: "spring" as const, stiffness: 100, damping: 15 },
  },
};

export function AnimatedPage({ children, className = "" }: AnimatedPageProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Nested stagger group – use inside AnimatedPage for grids/lists of AnimatedItem children. */
export function AnimatedStagger({ children, className = "" }: AnimatedPageProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedItem({ children, className = "", interactive = false }: AnimatedItemProps) {
  return (
    <motion.div
      variants={itemVariants}
      className={className}
      whileHover={interactive ? { y: -3, transition: { duration: 0.2, ease: "easeOut" } } : undefined}
    >
      {children}
    </motion.div>
  );
}
