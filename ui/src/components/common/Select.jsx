/**
 * Enterprise Select Component
 */

import React, { useId } from 'react';
import { FormLabel } from './FormLabel';

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
  const generatedId = useId();
  const selectId = props.id || props.name || `select-${generatedId}`;
  const errorId = `${selectId}-error`;
  const helpId = `${selectId}-help`;
  const describedBy = [
    props['aria-describedby'],
    error ? errorId : null,
    !error && helpText ? helpId : null,
  ].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`form-group ${className}`}>
      <FormLabel htmlFor={selectId} label={label} required={required} />
      <select 
        id={selectId}
        className={`h-11 w-full rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-900 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 ${error ? 'border-red-300 text-red-900 focus:border-red-500 focus:ring-red-500/20' : ''}`}
        disabled={disabled} 
        required={required} 
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        aria-required={required || undefined}
        {...props}
      >
        {children ? children : options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-sm text-red-500" id={errorId}>{error}</p>}
      {!error && helpText && <div className="form-help" id={helpId}>{helpText}</div>}
    </div>
  );
};
