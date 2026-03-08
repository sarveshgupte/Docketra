/**
 * Enterprise Textarea Component
 */

import React, { useId } from 'react';

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
  const generatedId = useId();
  const textareaId = props.id || props.name || `textarea-${generatedId}`;
  const errorId = `${textareaId}-error`;
  const helpId = `${textareaId}-help`;
  const describedBy = [
    props['aria-describedby'],
    error ? errorId : null,
    !error && helpText ? helpId : null,
  ].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`form-group ${className}`}>
      {label && (
        <label className="form-label" htmlFor={textareaId}>
          {label}
          {required && <span className="text-danger" aria-hidden="true"> *</span>}
        </label>
      )}
      <textarea
        id={textareaId}
        className={`input ${error ? 'input-error' : ''}`}
        disabled={disabled}
        readOnly={readOnly}
        rows={rows}
        style={{ minHeight: '100px', resize: 'vertical' }}
        required={required}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        aria-required={required || undefined}
        {...props}
      />
      {error && <div className="form-error" id={errorId}>{error}</div>}
      {!error && helpText && <div className="form-help" id={helpId}>{helpText}</div>}
    </div>
  );
};
