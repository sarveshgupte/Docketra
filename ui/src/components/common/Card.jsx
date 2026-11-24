/**
 * Enterprise Card Component
 * Built with modern shadcn composition and emil-design-eng polish:
 * - Nested radius formula: outer = inner + padding
 * - Clean 1px border with subtle shadow
 * - Full backward compatibility with existing CardHeader, CardBody, CardFooter
 * - Added CardTitle, CardDescription, CardContent for shadcn compatibility
 * - ForwardRef support on all subcomponents
 */

import React, { forwardRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { surfaceClasses } from '../../theme/tokens';

export const Card = forwardRef(({
  children,
  className = '',
  onClick,
  interactive = false,
  animateOnMount = false,
  ...props
}, ref) => {
  const shouldReduceMotion = useReducedMotion();
  const isInteractive = Boolean(interactive || onClick);

  const baseCardClasses = cn(
    surfaceClasses.card || 'bg-white border border-slate-200/90 rounded-[var(--dt-radius-card,6px)] shadow-[0_1px_2px_rgba(0,0,0,0.02)] overflow-hidden',
    isInteractive && 'transition-[background-color,border-color,box-shadow] duration-150 cursor-pointer hover:border-slate-300 hover:bg-slate-50/50 active:bg-slate-100/60',
    className
  );

  if (animateOnMount && !shouldReduceMotion) {
    return (
      <motion.div
        ref={ref}
        className={baseCardClasses}
        onClick={onClick}
        initial={{ opacity: 0, y: 4 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        {...props}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div
      ref={ref}
      className={baseCardClasses}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  );
});
Card.displayName = 'Card';

export const CardHeader = forwardRef(({
  title,
  action,
  children,
  className = '',
  ...props
}, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        'card-header flex items-center justify-between gap-3 pb-3 mb-3 border-b border-[var(--dt-border-whisper,rgba(226,232,240,0.8))]',
        className
      )}
      {...props}
    >
      {title && <h2 className="card-title text-xs font-semibold uppercase tracking-wider text-[var(--dt-text,#0f172a)]">{title}</h2>}
      {children}
      {action && <div className="card-action shrink-0">{action}</div>}
    </div>
  );
});
CardHeader.displayName = 'CardHeader';

export const CardTitle = forwardRef(({ className = '', ...props }, ref) => (
  <h3
    ref={ref}
    className={cn('text-xs font-semibold uppercase tracking-wider text-[var(--dt-text,#0f172a)]', className)}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

export const CardDescription = forwardRef(({ className = '', ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-xs text-[var(--dt-text-muted,#64748b)] leading-relaxed', className)}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

export const CardBody = forwardRef(({ children, className = '', ...props }, ref) => {
  return (
    <div ref={ref} className={cn('card-body', className)} {...props}>
      {children}
    </div>
  );
});
CardBody.displayName = 'CardBody';

export const CardContent = CardBody;

export const CardFooter = forwardRef(({ children, className = '', ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn('card-footer border-t border-[var(--dt-border-whisper,rgba(226,232,240,0.8))] pt-3 mt-3 flex items-center', className)}
      {...props}
    >
      {children}
    </div>
  );
});
CardFooter.displayName = 'CardFooter';
