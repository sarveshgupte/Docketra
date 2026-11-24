/**
 * Enterprise Input Component
 * Modernized with shadcn / better-ui architecture:
 * - Clear optical alignment and consistent 32px/min-h-8 control sizing
 * - Strict focus rings: focus-visible:ring-1 focus-visible:ring-slate-900
 * - Password visibility toggle with accessible ARIA semantics
 * - Read-only mode rendering as static value with lock icon
 * - Robust error and help text association via aria-describedby
 */

import React, { forwardRef, useId, useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { FormLabel } from './FormLabel';
import { formClasses } from '../../theme/tokens';
import { cn } from '../../lib/utils';

export const Input = forwardRef(({
  label,
  error,
  success,
  helpText,
  disabled = false,
  readOnly = false,
  required = false,
  className = '',
  inputClassName = '',
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
      <div className={cn('w-full', className)}>
        <FormLabel htmlFor={inputId} label={label} required={required} />
        <div
          className="flex items-center gap-2 py-1.5 px-3 rounded-[var(--dt-radius-control,2px)] bg-slate-50 border border-slate-200/80 text-xs text-slate-700 leading-relaxed"
          id={inputId}
          aria-readonly="true"
        >
          <span className="font-medium">{value || '-'}</span>
          <span className="text-slate-400">
            <Lock className="h-3 w-3 inline-block" aria-hidden="true" />
          </span>
        </div>
        {helpText && <p className={formClasses.helpText} id={helpId}>{helpText}</p>}
      </div>
    );
  }

  return (
    <div className={cn('w-full', className)}>
      <FormLabel htmlFor={inputId} label={label} required={required} />
      <div className="w-full relative">
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'flex min-h-8 w-full rounded-[var(--dt-radius-control,2px)] border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 transition-[border-color,box-shadow] duration-150',
            'hover:border-slate-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 focus-visible:border-slate-900',
            'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-200',
            formClasses.inputBase,
            error && cn('border-rose-500 focus-visible:ring-rose-500 focus-visible:border-rose-500', formClasses.inputError),
            !error && success && cn('border-emerald-500 focus-visible:ring-emerald-500 focus-visible:border-emerald-500', formClasses.inputSuccess),
            isPasswordType && 'pr-9',
            inputClassName
          )}
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
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 transition-colors hover:text-slate-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 cursor-pointer"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-pressed={showPassword}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        )}
      </div>
      {error && <p className={cn(formClasses.errorText, 'text-rose-600 text-xs mt-1')} id={errorId}>{error}</p>}
      {!error && success && (
        <p className={cn(formClasses.successText, 'text-emerald-600 text-xs mt-1 flex items-center gap-1')} id={helpId}>
          <span aria-hidden="true">✓</span>
          <span>{success}</span>
        </p>
      )}
      {!error && helpText && <p className={cn(formClasses.helpText, 'text-slate-500 text-xs mt-1')} id={helpId}>{helpText}</p>}
    </div>
  );
});

Input.displayName = 'Input';
