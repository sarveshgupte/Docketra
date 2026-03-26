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
        <label className="mb-1.5 block text-sm font-semibold text-gray-700" htmlFor={textareaId}>
          {label}
          {required && <span className="text-danger" aria-hidden="true"> *</span>}
        </label>
      )}
      <textarea
        id={textareaId}
        className={`w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 ${error ? 'border-red-300 text-red-900 focus:border-red-500 focus:ring-red-500/20' : ''}`}
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
      {error && <p className="mt-1 text-sm text-red-600" id={errorId}>{error}</p>}
      {!error && helpText && <div className="form-help" id={helpId}>{helpText}</div>}
    </div>
  );
};
