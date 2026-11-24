import React from 'react';
import { Badge } from './Badge';
import { cn } from '../../lib/utils';

const META = {
  GREEN: { label: 'SLA GREEN', variant: 'success' },
  YELLOW: { label: 'SLA YELLOW', variant: 'warning' },
  RED: { label: 'SLA RED', variant: 'danger' },
};

export const SlaBadge = ({ status = 'GREEN', className = '', label = null }) => {
  const normalized = String(status || 'GREEN').trim().toUpperCase();
  const meta = META[normalized] || META.GREEN;

  return (
    <Badge
      variant={meta.variant}
      className={cn('font-mono text-[10.5px] uppercase tracking-wider font-semibold', className)}
    >
      {label || meta.label}
    </Badge>
  );
};
