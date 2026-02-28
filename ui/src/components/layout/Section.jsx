import React from 'react';

export const Section = ({ children, className = '', muted = false }) => (
  <section className={`w-full py-24 px-6 ${muted ? 'bg-gray-50' : ''} ${className}`}>
    <div className="max-w-6xl mx-auto">{children}</div>
  </section>
);
