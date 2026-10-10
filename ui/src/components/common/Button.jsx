/**
 * Enterprise Button Component
 * Variants: primary, secondary, outline, danger
 * States: default, hover, active, disabled, loading
 */

import React from 'react';

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

export const Button = ({
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
  ...props
}) => {
  const normalizedSize = normalizeButtonSize(size);
  const normalizedVariant = normalizeVariant(variant);

  const baseClassesBySize = {
    xs: 'inline-flex min-h-6 items-center justify-center rounded-[var(--dt-radius-control)] font-medium leading-4 transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 disabled:cursor-not-allowed disabled:opacity-40 text-[11px] px-2 py-0.5',
    sm: 'inline-flex min-h-7 items-center justify-center rounded-[var(--dt-radius-control)] font-medium leading-4 transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 disabled:cursor-not-allowed disabled:opacity-40 text-xs px-2.5 py-1',
    md: 'inline-flex min-h-8 items-center justify-center rounded-[var(--dt-radius-control)] font-medium leading-5 transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 disabled:cursor-not-allowed disabled:opacity-40 text-xs px-3 py-1.5 active:scale-[0.99]',
    lg: 'inline-flex min-h-9 items-center justify-center rounded-[var(--dt-radius-control)] font-medium leading-5 transition-colors duration-150 ease-out focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 disabled:cursor-not-allowed disabled:opacity-40 text-sm px-4 py-2 active:scale-[0.99]',
  };

  const variantClasses = {
    primary: 'border-0 bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950 focus-visible:ring-slate-900 shadow-none',
    secondary:
      'border-0 bg-transparent text-slate-600 hover:text-slate-900 underline-offset-4 hover:underline focus-visible:ring-slate-900 shadow-none',
    outline:
      'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 hover:border-slate-300 focus-visible:ring-slate-900 shadow-none',
    danger: 'border-0 bg-transparent text-rose-600 hover:bg-rose-50 hover:text-rose-700 active:bg-rose-100 focus-visible:ring-rose-600 shadow-none',
    ghost: 'border-0 bg-transparent text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 focus-visible:ring-slate-900 shadow-none',
  };

  const isDisabled = disabled || loading;
  const layoutClassName = allowUnsafeClassName ? className : sanitizeLayoutClasses(className);

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={`${baseClassesBySize[normalizedSize]} ${fullWidth ? 'w-full' : ''} ${variantClasses[normalizedVariant] || variantClasses.secondary} ${layoutClassName}`}
      {...props}
    >
      {loading && (
        <svg
          className="-ml-1 mr-2 inline-block h-4 w-4 animate-spin"
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
};
