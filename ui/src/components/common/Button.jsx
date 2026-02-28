/**
 * Enterprise Button Component
 * Variants: primary, secondary, danger, outline
 * States: default, hover, active, disabled, loading
 */

import React from 'react';

export const Button = ({
  children,
  onClick,
  type = 'button',
  variant = 'secondary',
  disabled = false,
  loading = false,
  className = '',
  ...props
}) => {
  const baseClasses = 'btn transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]';
  const variantClasses = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    outline: 'btn-secondary',
    danger: 'btn-danger',
  };

  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={`${baseClasses} ${variantClasses[variant] || variantClasses.secondary} ${className}`}
      {...props}
    >
      {loading && (
        <svg
          className="-ml-1 mr-2 inline-block h-4 w-4 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
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
