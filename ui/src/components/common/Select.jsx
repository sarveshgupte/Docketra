/**
 * Enterprise Select Component
 * Modernized with shadcn / better-ui architecture:
 * - Native accessible select with customized chevron indicator
 * - Optical alignment with 32px/min-h-8 control sizing
 * - ForwardRef support
 * - Strict focus-visible ring styles
 */

import React, { forwardRef, useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { FormLabel } from './FormLabel';
import { formClasses } from '../../theme/tokens';
import { cn } from '../../lib/utils';

export const Select = forwardRef(({
  label,
  error,
  success,
  helpText,
  options = [],
  disabled = false,
  required = false,
  className = '',
  selectClassName = '',
  children,
  ...props
}, ref) => {
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
    <div className={cn('w-full', className)}>
      <FormLabel htmlFor={selectId} label={label} required={required} />
      <div className="relative w-full">
        <select 
          ref={ref}
          id={selectId}
          className={cn(
            'flex min-h-8 w-full appearance-none rounded-[var(--dt-radius-control,2px)] border border-slate-200 bg-white px-3 pr-8 py-1.5 text-xs text-slate-900 transition-[border-color,box-shadow] duration-150',
            'hover:border-slate-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 focus-visible:border-slate-900',
            'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-200',
            formClasses.inputBase,
            error && 'border-rose-500 focus-visible:ring-rose-500 focus-visible:border-rose-500',
            !error && success && 'border-emerald-500 focus-visible:ring-emerald-500 focus-visible:border-emerald-500',
            selectClassName
          )}
          disabled={disabled} 
          required={required} 
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          aria-required={required || undefined}
          {...props}
        >
          {children ? children : (
            options.length > 0 ? options.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            )) : <option value="" disabled>No options found</option>
          )}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
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

Select.displayName = 'Select';
