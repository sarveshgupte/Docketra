/**
 * Enterprise Textarea Component
 */

import React, { useId } from 'react';
import { FormLabel } from './FormLabel';
import { formClasses } from '../../theme/tokens';

export const Textarea = ({
  label,
  error,
  success,
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
    <div className={`w-full ${className}`}>
      <FormLabel htmlFor={textareaId} label={label} required={required} />
      <textarea
        id={textareaId}
        className={`${formClasses.textareaBase} ${error ? 'border-red-300 text-red-900 focus:border-red-500 focus:ring-red-500/20' : ''} ${!error && success ? formClasses.inputSuccess : ''}`}
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
};
