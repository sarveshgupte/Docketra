/**
 * Enterprise Card Component
 * Structure: Card with optional Header, Body, and Footer
 */

import React from 'react';

export const Card = ({ children, className = '', onClick, interactive = false, ...props }) => {
  const interactiveClass = interactive || onClick
    ? 'shadow-md hover:shadow-xl transition-shadow duration-300 cursor-pointer'
    : 'shadow-md';

  return (
    <div
      className={`card rounded-2xl border border-gray-200 p-6 ${interactiveClass} ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({ title, action, children, className = '' }) => {
  return (
    <div className={`card-header ${className}`}>
      {title && <h2 className="card-title">{title}</h2>}
      {children}
      {action && <div className="card-action">{action}</div>}
    </div>
  );
};

export const CardBody = ({ children, className = '' }) => {
  return <div className={`card-body ${className}`}>{children}</div>;
};

export const CardFooter = ({ children, className = '' }) => {
  return <div className={`card-footer border-t border-gray-200 pt-4 mt-4 ${className}`}>{children}</div>;
};
