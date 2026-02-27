/**
 * Impersonation Banner Component — 2026 Edition
 * Glassmorphic, highly visible — screams "Read-Only Mode"
 */

import React from 'react';
import { Button } from './Button';
import './ImpersonationBanner.css';

export const ImpersonationBanner = ({ firmName, mode, onExit }) => {
  if (!firmName) return null;

  const isReadOnly = mode === 'READ_ONLY';
  const modeLabel = isReadOnly ? 'Read-Only' : 'Full Access';
  const ariaLabel = isReadOnly
    ? 'Read-only impersonation mode — view only, no changes allowed'
    : 'Full access impersonation mode — changes are allowed';

  return (
    <div
      className={`impersonation-banner ${isReadOnly ? 'impersonation-banner--read-only' : 'impersonation-banner--full-access'}`}
      role="alert"
      aria-live="polite"
      aria-label={ariaLabel}
    >
      <div className="impersonation-banner__content">
        <span className="impersonation-banner__pill" aria-hidden="true">
          {isReadOnly ? '👁' : '✏️'}
          <span className="impersonation-banner__pill-label">{modeLabel}</span>
        </span>
        <span className="impersonation-banner__text">
          Impersonating <strong>{firmName}</strong>
          {isReadOnly && (
            <span className="impersonation-banner__readonly-note"> — no edits permitted</span>
          )}
        </span>
        <Button
          variant="secondary"
          size="small"
          onClick={onExit}
          className="impersonation-banner__exit-btn"
          aria-label={`Exit impersonation of ${firmName}`}
        >
          Exit Firm
        </Button>
      </div>
    </div>
  );
};
