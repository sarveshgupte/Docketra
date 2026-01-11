/**
 * Enterprise Card Component
 * Structure: Card with optional Header, Body, and Footer
 */

import React from 'react';

export const Card = ({ children, className = '', onClick, ...props }) => {
  return (
    <div
      className={`card ${className}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
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
  return (
    <div className={`card-footer border-t border-border-subtle ${className}`} style={{ paddingTop: 'var(--spacing-md)', marginTop: 'var(--spacing-md)' }}>
      {children}
    </div>
  );
};
