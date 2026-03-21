// NEW
import React from 'react';

export const SkeletonLoader = ({ variant = 'table', rows = 5 }) => {
  if (variant === 'table') {
    return (
      <div className="skeleton-loader" aria-hidden="true">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="skeleton-loader__row" />
        ))}
      </div>
    );
  }

  return <div className="skeleton-loader__block" aria-hidden="true" />;
};
