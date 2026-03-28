import React from 'react';

export default function Container({ children, className = '' }) {
  return (
    <div className={`mx-auto w-full max-w-6xl px-4 md:px-6 ${className}`.trim()}>
      {children}
    </div>
  );
}
