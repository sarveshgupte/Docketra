import React from 'react';
import { motion } from 'framer-motion';

export const PageWrapper = ({ children, __motionState }) => {
  return (
    <motion.div
      __motionState={__motionState}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
};
