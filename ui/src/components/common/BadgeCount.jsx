import React from 'react';
import './BadgeCount.css';

export const BadgeCount = ({ count, variant = 'primary' }) => {
  if (count === null || count === undefined || count === 0) {
    return null;
  }

  if (count === 'loading') {
    return (
      <span className="badge-count badge-count--loading" aria-busy="true" aria-label="Loading count">
        …
      </span>
    );
  }

  const displayCount = typeof count === 'number' && count > 99 ? '99+' : count;

  return <span className={`badge-count badge-count--${variant}`}>{displayCount}</span>;
};
