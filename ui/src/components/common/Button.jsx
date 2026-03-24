/**
 * Enterprise Button Component
 * Variants: primary, secondary, outline, danger
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
  fullWidth = false,
  className = '',
  ...props
}) => {
  const baseClasses =
    'btn transition-all duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

  const variantClasses = {
    primary: 'btn-primary hover:bg-blue-700 active:bg-blue-800 focus-visible:ring-blue-600',
    secondary: 'btn-secondary hover:bg-gray-100 active:bg-gray-200 focus-visible:ring-gray-500',
    outline: 'btn-outline hover:bg-gray-50 active:bg-gray-100 focus-visible:ring-gray-500',
    danger: 'btn-danger hover:bg-red-700 active:bg-red-800 focus-visible:ring-red-600',
    ghost: 'border border-transparent bg-transparent text-gray-700 hover:bg-gray-100 active:bg-gray-200 focus-visible:ring-gray-500',
  };

  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={`${baseClasses} ${fullWidth ? 'w-full' : ''} ${variantClasses[variant] || variantClasses.secondary} ${className}`}
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
