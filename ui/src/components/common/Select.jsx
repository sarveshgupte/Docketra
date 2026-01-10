/**
 * Enterprise Select Component
 */

import React from 'react';

export const Select = ({
  label,
  error,
  helpText,
  options = [],
  disabled = false,
  required = false,
  className = '',
  children,
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
      <select 
        className={`input ${error ? 'input-error' : ''}`}
        disabled={disabled} 
        required={required} 
        {...props}
      >
        {children ? children : options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <div className="form-error">{error}</div>}
      {!error && helpText && <div className="form-help">{helpText}</div>}
    </div>
  );
};
