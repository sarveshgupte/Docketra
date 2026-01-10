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
          <span className="text-text-muted text-xs">🔒</span>
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
