import React from 'react';
import { Button } from './Button';

export const QueueFilterBar = ({ children, onClear, clearDisabled = false, className = '' }) => (
  <div className={`rounded-lg border border-slate-200 bg-slate-50/70 p-3 md:p-4 ${className}`} role="search" aria-label="Queue filters">
    <div className="flex flex-wrap items-end gap-3">
      {children}
      {onClear ? (
        <Button type="button" variant="outline" size="sm" onClick={onClear} disabled={clearDisabled}>
          Clear all
        </Button>
      ) : null}
    </div>
  </div>
);

export default QueueFilterBar;
