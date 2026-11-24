import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';
import { formClasses } from '../../theme/tokens';

export const FormLabel = forwardRef(({
  htmlFor,
  label,
  children,
  required = false,
  className = '',
  ...props
}, ref) => {
  const content = children || label;
  if (!content) return null;

  const cleanedLabel = typeof content === 'string' ? content.replace(/\s*\*+$/, '') : content;
  const isRequired = required || (typeof content === 'string' && /\*+$/.test(content));

  return (
    <label
      ref={ref}
      htmlFor={htmlFor}
      className={cn(
        'mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 select-none',
        formClasses.label,
        className
      )}
      {...props}
    >
      {cleanedLabel}
      {isRequired && (
        <span className="ml-1 text-rose-600 font-bold" aria-hidden="true">
          *
        </span>
      )}
    </label>
  );
});

FormLabel.displayName = 'FormLabel';
export const Label = FormLabel;
