/**
 * Enterprise Select Component
 */

import React, { useId } from 'react';
import { FormLabel } from './FormLabel';
import { formClasses } from '../../theme/tokens';

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
    <div className={`w-full ${className}`}>
      <FormLabel htmlFor={selectId} label={label} required={required} />
      <select 
        id={selectId}
        className={`${formClasses.inputBase} ${error ? 'border-red-300 text-red-900 focus:border-red-500 focus:ring-red-500/20' : ''}`}
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
      {error && <p className={formClasses.errorText} id={errorId}>{error}</p>}
      {!error && helpText && <p className={formClasses.helpText} id={helpId}>{helpText}</p>}
    </div>
  );
};
