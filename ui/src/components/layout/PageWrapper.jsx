import React from 'react';
import { motion } from 'framer-motion';

export const PageWrapper = ({ children, __motionState }) => {
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion) {
    return children;
  }

  return (
    <motion.div
      className="flex w-full flex-1 min-w-0 flex-col"
      __motionState={__motionState}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
};
