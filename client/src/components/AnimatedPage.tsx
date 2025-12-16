import { motion } from "framer-motion";
import { ReactNode, useEffect } from "react";

interface AnimatedPageProps {
  children: ReactNode;
  className?: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 100, damping: 15 },
  },
};

export function AnimatedPage({ children, className = "" }: AnimatedPageProps) {
  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7243/ingest/e54bf5a1-a12e-470b-9800-914f012d5363',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AnimatedPage.tsx:29',message:'AnimatedPage mounted',data:{hasChildren:!!children,className,currentPath:window.location.pathname},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,B'})}).catch(()=>{});
    return () => {
      fetch('http://127.0.0.1:7243/ingest/e54bf5a1-a12e-470b-9800-914f012d5363',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AnimatedPage.tsx:31',message:'AnimatedPage unmounting',data:{currentPath:window.location.pathname},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A,B'})}).catch(()=>{});
    };
  }, []);
  // #endregion
  
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

export function AnimatedItem({ children, className = "" }: AnimatedPageProps) {
  return (
    <motion.div variants={itemVariants} className={className}>
      {children}
    </motion.div>
  );
}
