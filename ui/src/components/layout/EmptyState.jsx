import React from 'react';
import { Button } from '../common/Button';
import './layoutPrimitives.css';

export const EmptyState = ({ title, description, actionLabel, onAction }) => {
  return (
    <div className="empty-state">
      <div className="empty-state__icon" aria-hidden="true">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7h18v12H3z" />
          <path d="M3 11h18" />
          <path d="M8 7V5h8v2" />
        </svg>
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {actionLabel && onAction ? (
        <Button variant="primary" onClick={onAction}>{actionLabel}</Button>
      ) : null}
    </div>
  );
};
