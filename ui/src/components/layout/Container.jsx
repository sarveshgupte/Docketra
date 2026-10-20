import React from 'react';

const SIZE_MAP = {
  '7xl': 'max-w-7xl',
  '6xl': 'max-w-6xl',
  '5xl': 'max-w-5xl',
  '4xl': 'max-w-4xl',
  '3xl': 'max-w-3xl',
  '2xl': 'max-w-2xl',
  'xl': 'max-w-xl',
  'full': 'max-w-full',
};

export default function Container({ children, className = '', size = '7xl' }) {
  const sizeClass = SIZE_MAP[size] || (size ? `max-w-${size}` : 'max-w-7xl');

  return (
    <div className={`mx-auto w-full ${sizeClass} px-4 sm:px-6 lg:px-8 ${className}`.trim()}>
      {children}
    </div>
  );
}
