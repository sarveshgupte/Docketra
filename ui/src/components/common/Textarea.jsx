/**
 * Enterprise Textarea Component
 */

import React from 'react';

export const Textarea = ({
  label,
  error,
  helpText,
  disabled = false,
  readOnly = false,
  required = false,
  className = '',
  rows = 4,
  ...props
}) => {
  return (
    <div className={`form-group ${className}`}>
      {label && (
        <label className="form-label">
          {label}
          {required && <span className="text-danger"> *</span>}
        </label>
      )}
      <textarea
        className={`input ${error ? 'input-error' : ''}`}
        disabled={disabled}
        readOnly={readOnly}
        rows={rows}
        style={{ minHeight: '100px', resize: 'vertical' }}
        {...props}
      />
      {error && <div className="form-error">{error}</div>}
      {!error && helpText && <div className="form-help">{helpText}</div>}
    </div>
  );
};
