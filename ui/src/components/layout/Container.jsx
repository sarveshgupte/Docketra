import React from 'react';

export default function Container({ children, className = '', size = '6xl' }) {
  const sizeClass = size === '7xl' ? 'max-w-7xl' : 'max-w-6xl';

  return (
    <div className={`mx-auto w-full ${sizeClass} px-4 md:px-6 ${className}`.trim()}>
      {children}
    </div>
  );
}
