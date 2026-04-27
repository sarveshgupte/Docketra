import React from 'react';
import { formClasses } from '../../theme/tokens';

export const FormLabel = ({ htmlFor, label, required = false, className = '' }) => {
  if (!label) return null;

  return (
    <label
      htmlFor={htmlFor}
      className={`mb-1 ${formClasses.label} ${className}`.trim()}
    >
      {label}
      {required && (
        <span className="ml-1 text-[var(--dt-error)]" aria-hidden="true">
          *
        </span>
      )}
    </label>
  );
};
