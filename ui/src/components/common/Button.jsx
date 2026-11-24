/**
 * Enterprise Button Component
 * Built with CVA and modern shadcn design-system architecture.
 * Strict compliance with /better-ui, /better-interface, and emil-design-eng:
 * - Optical alignment with SVG icons
 * - Motion-safe active press with enabled: guard (motion-safe:enabled:active:scale-[0.98])
 * - Explicit transition properties (no transition-all)
 * - Strict contract preservation for legacy aliases (small->sm, medium->md, warning->danger)
 */

import React, { forwardRef } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const LAYOUT_CLASS_PATTERNS = [
  /^(m|mx|my|mt|mr|mb|ml)-/, // margin utilities
  /^-m(x|y|t|r|b|l)?-/, // negative margin utilities
  /^grow(?:-0)?$/, // flex-grow utilities
  /^shrink(?:-0)?$/, // flex-shrink utilities
  /^basis-/, // flex-basis utilities
  /^self-/, // self-alignment utilities
];

const sanitizeLayoutClasses = (className = '') =>
  className
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => LAYOUT_CLASS_PATTERNS.some((pattern) => pattern.test(token)))
    .join(' ');

const normalizeButtonSize = (size) => {
  const aliases = {
    xs: 'xs',
    sm: 'sm',
    small: 'sm',
    md: 'md',
    medium: 'md',
    lg: 'lg',
    large: 'lg',
  };

  return aliases[size] || 'md';
};

const normalizeVariant = (variant) => {
  const aliases = {
    default: 'secondary',
    warning: 'danger',
  };

  return aliases[variant] || variant;
};

export const buttonVariants = cva(
  'inline-flex items-center justify-center select-none rounded-[var(--dt-radius-control,2px)] font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 motion-safe:enabled:active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary:
          'action-primary btn-primary border border-transparent bg-slate-900 text-white shadow-none hover:bg-slate-800 active:bg-slate-950 focus-visible:ring-slate-900',
        secondary:
          'border-0 bg-transparent text-slate-600 hover:text-slate-900 underline-offset-4 hover:underline focus-visible:ring-slate-900 shadow-none',
        outline:
          'border border-slate-200 bg-white text-slate-800 shadow-none hover:bg-slate-50 hover:border-slate-300 focus-visible:ring-slate-900',
        danger:
          'border-0 bg-transparent text-rose-600 hover:bg-rose-50 hover:text-rose-700 active:bg-rose-100 focus-visible:ring-rose-600 shadow-none',
        ghost:
          'border-0 bg-transparent text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 focus-visible:ring-slate-900 shadow-none',
      },
      size: {
        xs: 'min-h-6 text-[11px] leading-4 px-2 py-0.5 gap-1',
        sm: 'min-h-7 text-xs leading-4 px-2.5 py-1 gap-1.5',
        md: 'min-h-8 text-xs leading-5 px-3 py-1.5 gap-2',
        lg: 'min-h-9 text-sm leading-5 px-4 py-2 gap-2',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'md',
    },
  }
);

export const Button = forwardRef(({
  children,
  onClick,
  type = 'button',
  variant = 'secondary',
  disabled = false,
  loading = false,
  size = 'md',
  fullWidth = false,
  className = '',
  allowUnsafeClassName = false,
  'data-primary': dataPrimaryProp,
  ...props
}, ref) => {
  const normalizedSize = normalizeButtonSize(size);
  const normalizedVariant = normalizeVariant(variant);
  const isPrimary = normalizedVariant === 'primary';
  const dataPrimary = dataPrimaryProp ?? (isPrimary ? 'true' : undefined);

  const isDisabled = disabled || loading;
  const layoutClassName = allowUnsafeClassName ? className : sanitizeLayoutClasses(className);

  return (
    <button
      ref={ref}
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      data-primary={dataPrimary}
      className={cn(
        buttonVariants({ variant: normalizedVariant, size: normalizedSize }),
        fullWidth && 'w-full',
        layoutClassName
      )}
      {...props}
    >
      {loading && (
        <svg
          className="-ml-0.5 inline-block h-3.5 w-3.5 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  );
});

Button.displayName = 'Button';
