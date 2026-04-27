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
    xs: 'inline-flex min-h-7 items-center justify-center rounded-[var(--dt-radius-control)] border font-medium leading-4 transition-colors duration-150 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--dt-surface)] disabled:cursor-not-allowed disabled:opacity-60 text-xs px-2 py-1',
    sm: 'inline-flex min-h-8 items-center justify-center rounded-[var(--dt-radius-control)] border font-medium leading-4 transition-colors duration-150 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--dt-surface)] disabled:cursor-not-allowed disabled:opacity-60 text-xs px-3 py-1.5',
    md: 'inline-flex min-h-11 items-center justify-center rounded-[var(--dt-radius-control)] border font-medium leading-5 transition-colors duration-150 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--dt-surface)] disabled:cursor-not-allowed disabled:opacity-60 text-sm px-4 py-2.5',
    lg: 'inline-flex min-h-12 items-center justify-center rounded-[var(--dt-radius-control)] border font-medium leading-5 transition-colors duration-150 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--dt-surface)] disabled:cursor-not-allowed disabled:opacity-60 text-base px-5 py-3',
  };

  const variantClasses = {
    primary: 'border-[var(--dt-accent)] bg-[var(--dt-accent)] text-[var(--dt-text-inverse)] hover:border-[var(--dt-accent-hover)] hover:bg-[var(--dt-accent-hover)] active:border-[var(--dt-accent-active)] active:bg-[var(--dt-accent-active)] focus-visible:ring-[var(--dt-focus)]',
    secondary:
      'border-[var(--dt-border)] bg-[var(--dt-surface)] text-[var(--dt-text)] hover:bg-[var(--dt-surface-subtle)] active:bg-[var(--dt-surface-muted)] focus-visible:ring-[var(--dt-focus)]',
    outline:
      'border-[var(--dt-border)] bg-transparent text-[var(--dt-text)] hover:bg-[var(--dt-surface-subtle)] active:bg-[var(--dt-surface-muted)] focus-visible:ring-[var(--dt-focus)]',
    danger: 'border-[var(--dt-error)] bg-[var(--dt-error)] text-[var(--dt-text-inverse)] hover:brightness-105 active:brightness-95 focus-visible:ring-[var(--dt-error)]',
    ghost: 'border-transparent bg-transparent text-[var(--dt-text)] hover:bg-[var(--dt-surface-muted)] active:bg-[var(--dt-surface-muted)] focus-visible:ring-[var(--dt-focus)]',
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
