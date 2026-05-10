/**
 * Enterprise Card Component
 * Structure: Card with optional Header, Body, and Footer
 */

import React from 'react';
import { motion } from 'framer-motion';
import { surfaceClasses } from '../../theme/tokens';

export const Card = ({ children, className = '', onClick, interactive = false, animateOnMount = false, ...props }) => {
  const isInteractive = interactive || !!onClick;
  const interactiveClass = isInteractive
    ? 'transition-colors duration-150 cursor-pointer hover:border-[var(--dt-border)] hover:bg-[var(--dt-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dt-focus)]'
    : '';

  const cardClasses = `${surfaceClasses.card} ${interactiveClass} ${className}`;

  const handleKeyDown = (event) => {
    if (onClick && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      onClick(event);
    }
  };

  const interactiveProps = isInteractive ? {
    role: 'button',
    tabIndex: 0,
    onKeyDown: handleKeyDown,
  } : {};

  if (animateOnMount) {
    return (
      <motion.div
        className={cardClasses}
        onClick={onClick}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        {...interactiveProps}
        {...props}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div
      className={cardClasses}
      onClick={onClick}
      {...interactiveProps}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({ title, action, children, className = '' }) => {
  return (
    <div className={`card-header ${className}`}>
      {title && <h2 className="card-title">{title}</h2>}
      {children}
      {action && <div className="card-action">{action}</div>}
    </div>
  );
};

export const CardBody = ({ children, className = '' }) => {
  return <div className={`card-body ${className}`}>{children}</div>;
};

export const CardFooter = ({ children, className = '' }) => {
  return <div className={`card-footer border-t border-[var(--dt-border-whisper)] pt-4 mt-4 ${className}`}>{children}</div>;
};
