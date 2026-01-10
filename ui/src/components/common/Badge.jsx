/**
 * Enterprise Badge Component
 * Pill-shaped status indicators with semantic colors
 */

import React from 'react';
import { getStatusColor } from '../../utils/formatters';

export const Badge = ({ children, variant, status, className = '' }) => {
  // If status is provided, use it to determine variant
  const badgeVariant = status ? getStatusColor(status) : variant;
  
  const variantClasses = {
    success: 'badge-success',
    warning: 'badge-warning',
    danger: 'badge-danger',
    info: 'badge-info',
    neutral: 'badge-neutral',
  };
  
  const variantClass = variantClasses[badgeVariant] || variantClasses.neutral;
  
  return (
    <span className={`badge ${variantClass} ${className}`}>
      {children}
    </span>
  );
};
