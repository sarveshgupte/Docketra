/**
 * Impersonation Banner Component
 * Shows a warning banner when SuperAdmin is impersonating a firm
 */

import React from 'react';
import { Button } from './Button';
import './ImpersonationBanner.css';

export const ImpersonationBanner = ({ firmName, mode, onExit }) => {
  if (!firmName) return null;

  const isReadOnly = mode === 'READ_ONLY';
  const modeLabel = isReadOnly ? 'Read-Only' : 'Full Access';
  const modeIcon = isReadOnly ? '👁️' : '✏️';
  const ariaLabel = isReadOnly ? 'Read-only mode - view only, no changes allowed' : 'Full access mode - changes allowed';

  return (
    <div className={`impersonation-banner ${isReadOnly ? 'impersonation-banner--read-only' : 'impersonation-banner--full-access'}`}>
      <div className="impersonation-banner__content">
        <span className="impersonation-banner__icon" role="img" aria-label={ariaLabel}>{modeIcon}</span>
        <span className="impersonation-banner__text">
          You are impersonating <strong>{firmName}</strong> ({modeLabel})
        </span>
        <Button
          variant="secondary"
          size="small"
          onClick={onExit}
          className="impersonation-banner__exit-btn"
        >
          Exit Firm
        </Button>
      </div>
    </div>
  );
};
