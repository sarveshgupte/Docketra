import React from 'react';
import { caseStatusAppearance } from '../../lib/designTokens';
import './layoutPrimitives.css';

export const StatusBadge = ({ status }) => {
  const normalizedStatus = String(status || 'DRAFT').toUpperCase();
  const appearance = caseStatusAppearance[normalizedStatus] || {
    label: normalizedStatus.replaceAll('_', ' '),
    tone: 'draft',
  };

  return <span className={`status-badge status-badge--${appearance.tone}`}>{appearance.label}</span>;
};
