import React from 'react';
import { formClasses } from '../../theme/tokens';

export const FormLabel = ({ htmlFor, label, required = false, className = '' }) => {
  if (!label) return null;

  const cleanedLabel = typeof label === 'string' ? label.replace(/\s*\*+$/, '') : label;
  const isRequired = required || (typeof label === 'string' && /\*+$/.test(label));

  return (
    <label
      htmlFor={htmlFor}
      className={`mb-1 ${formClasses.label} ${className}`.trim()}
    >
      {cleanedLabel}
      {isRequired && (
        <span className="ml-1 text-[var(--dt-error)]" aria-hidden="true">
          *
        </span>
      )}
    </label>
  );
};
