import React from 'react';
import { PageSkeleton, TableSkeleton, FormSkeleton, SkeletonBlock } from '../common/Skeleton';

export const SkeletonLoader = ({ variant = 'table', rows = 5 }) => {
  if (variant === 'table') {
    return <TableSkeleton rows={rows} showToolbar={false} />;
  }

  if (variant === 'form') {
    return <FormSkeleton />;
  }

  if (variant === 'text') {
    return (
      <div className="skeleton-loader" aria-hidden="true">
        <SkeletonBlock style={{ width: '100%', height: '12px', marginBottom: 'var(--space-2)' }} />
        <SkeletonBlock style={{ width: '88%', height: '12px', marginBottom: 'var(--space-2)' }} />
        <SkeletonBlock style={{ width: '64%', height: '12px' }} />
      </div>
    );
  }

  if (variant === 'card') {
    return <PageSkeleton variant="card" />;
  }

  return <PageSkeleton />;
};
