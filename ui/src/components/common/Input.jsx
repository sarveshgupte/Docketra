/**
 * Enterprise Input Component
 * Supports validation, error states, help text
 * Read-only fields render as text, not disabled inputs
 */

import React from 'react';

export const Input = ({
  label,
  error,
  helpText,
  disabled = false,
  readOnly = false,
  required = false,
  className = '',
  value,
  ...props
}) => {
  // If read-only, render as static text instead of disabled input
  if (readOnly && value !== undefined) {
    return (
      <div className={`form-group ${className}`}>
        {label && (
          <label className="form-label">
            {label}
            {required && <span className="text-danger"> *</span>}
          </label>
        )}
        <div className="flex items-center gap-2 py-2 text-text-body">
          <span>{value || '-'}</span>
          <span className="text-text-muted text-xs">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 1C4.34 1 3 2.34 3 4V5H2.5C1.67 5 1 5.67 1 6.5V10.5C1 11.33 1.67 12 2.5 12H9.5C10.33 12 11 11.33 11 10.5V6.5C11 5.67 10.33 5 9.5 5H9V4C9 2.34 7.66 1 6 1ZM6 2C7.11 2 8 2.89 8 4V5H4V4C4 2.89 4.89 2 6 2Z"/>
            </svg>
          </span>
        </div>
        {helpText && <div className="form-help">{helpText}</div>}
      </div>
    );
  }
  
  return (
    <div className={`form-group ${className}`}>
      {label && (
        <label className="form-label">
          {label}
          {required && <span className="text-danger"> *</span>}
        </label>
      )}
      <input
        className={`input ${error ? 'input-error' : ''}`}
        disabled={disabled}
        value={value}
        {...props}
      />
      {error && <div className="form-error">{error}</div>}
      {!error && helpText && <div className="form-help">{helpText}</div>}
    </div>
  );
};
