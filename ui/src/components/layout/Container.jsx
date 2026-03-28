import React from 'react';

export default function Container({ children, className = '' }) {
  return <div className={`mx-auto max-w-7xl px-6 lg:px-8 ${className}`.trim()}>{children}</div>;
}
