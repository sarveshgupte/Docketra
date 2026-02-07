/**
 * Impersonation Banner Component
 * Shows a warning banner when SuperAdmin is impersonating a firm
 */

import React from 'react';
import { Button } from './Button';
import './ImpersonationBanner.css';

export const ImpersonationBanner = ({ firmName, onExit }) => {
  if (!firmName) return null;

  return (
    <div className="impersonation-banner">
      <div className="impersonation-banner__content">
        <span className="impersonation-banner__icon">🔒</span>
        <span className="impersonation-banner__text">
          You are impersonating <strong>{firmName}</strong>
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
