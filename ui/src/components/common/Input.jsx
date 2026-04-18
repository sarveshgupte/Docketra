/**
 * Enterprise Input Component
 * Supports validation, error states, help text
 * Read-only fields render as text, not disabled inputs
 */

import React, { forwardRef, useId, useState } from 'react';
import { FormLabel } from './FormLabel';
import { formClasses } from '../../theme/tokens';

export const Input = forwardRef(({
  label,
  error,
  success,
  helpText,
  disabled = false,
  readOnly = false,
  required = false,
  className = '',
  value,
  type = 'text',
  ...props
}, ref) => {
  const [showPassword, setShowPassword] = useState(false);
  const generatedId = useId();
  const isPasswordType = type === 'password';
  const resolvedType = isPasswordType ? (showPassword ? 'text' : 'password') : type;
  const inputId = props.id || props.name || `input-${generatedId}`;
  const errorId = `${inputId}-error`;
  const helpId = `${inputId}-help`;
  const describedBy = [
    props['aria-describedby'],
    error ? errorId : null,
    !error && helpText ? helpId : null,
  ].filter(Boolean).join(' ') || undefined;

  if (readOnly && value !== undefined) {
    return (
      <div className={`w-full ${className}`}>
        <FormLabel htmlFor={inputId} label={label} required={required} />
        <div className="flex items-center gap-2 py-2 text-sm text-gray-600 leading-relaxed" id={inputId} aria-readonly="true">
          <span>{value || '-'}</span>
          <span className="text-gray-400 text-xs">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 1C4.34 1 3 2.34 3 4V5H2.5C1.67 5 1 5.67 1 6.5V10.5C1 11.33 1.67 12 2.5 12H9.5C10.33 12 11 11.33 11 10.5V6.5C11 5.67 10.33 5 9.5 5H9V4C9 2.34 7.66 1 6 1ZM6 2C7.11 2 8 2.89 8 4V5H4V4C4 2.89 4.89 2 6 2Z"/>
            </svg>
          </span>
        </div>
        {helpText && <p className={formClasses.helpText} id={helpId}>{helpText}</p>}
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`}>
      <FormLabel htmlFor={inputId} label={label} required={required} />
      <div className="w-full relative">
        <input
          ref={ref}
          id={inputId}
          className={`${formClasses.inputBase} ${error ? formClasses.inputError : ''} ${!error && success ? formClasses.inputSuccess : ''} ${isPasswordType ? 'pr-11' : ''}`}
          disabled={disabled}
          value={value}
          type={resolvedType}
          required={required}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          aria-required={required || undefined}
          {...props}
        />
        {isPasswordType && (
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded text-gray-500 transition-colors hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-pressed={showPassword}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M3 3l18 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M10.58 10.58a3 3 0 004.16 4.16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M9.88 4.24A9.55 9.55 0 0121 12s-3 5-9 5a9.42 9.42 0 01-2.35-.29"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M6.12 6.12A9.53 9.53 0 003 12s3 5 9 5a9.59 9.59 0 004.77-1.23"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="3"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        )}
      </div>
      {error && <p className={formClasses.errorText} id={errorId}>{error}</p>}
      {!error && success && (
        <p className={formClasses.successText} id={helpId}>
          <span aria-hidden="true">✓</span>
          <span>{success}</span>
        </p>
      )}
      {!error && helpText && <p className={formClasses.helpText} id={helpId}>{helpText}</p>}
    </div>
  );
});

Input.displayName = 'Input';
