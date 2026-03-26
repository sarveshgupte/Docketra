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

export const Button = ({
  children,
  onClick,
  type = 'button',
  variant = 'secondary',
  disabled = false,
  loading = false,
  fullWidth = false,
  className = '',
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-sm px-4 py-2';

  const variantClasses = {
    primary: 'bg-primary text-white hover:brightness-110 active:brightness-90 focus-visible:ring-primary',
    secondary:
      'border border-border bg-white text-textMain hover:bg-slate-50 active:bg-slate-100 focus-visible:ring-textMuted',
    outline:
      'border border-border bg-transparent text-textMain hover:bg-slate-50 active:bg-slate-100 focus-visible:ring-textMuted',
    danger: 'bg-error text-white hover:brightness-110 active:brightness-90 focus-visible:ring-error',
    ghost: 'border border-transparent bg-transparent text-textMain hover:bg-slate-100 active:bg-slate-200 focus-visible:ring-textMuted',
  };

  const isDisabled = disabled || loading;
  const layoutClassName = sanitizeLayoutClasses(className);

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={`${baseClasses} ${fullWidth ? 'w-full' : ''} ${variantClasses[variant] || variantClasses.secondary} ${layoutClassName}`}
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
