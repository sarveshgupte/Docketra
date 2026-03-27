import React from 'react';

export const FormLabel = ({ htmlFor, label, required = false, className = '' }) => {
  if (!label) return null;

  return (
    <label
      htmlFor={htmlFor}
      className={`mb-1 block text-sm font-medium text-gray-900 ${className}`.trim()}
    >
      {label}
      {required && (
        <span className="ml-1 text-red-500" aria-hidden="true">
          *
        </span>
      )}
    </label>
  );
};

