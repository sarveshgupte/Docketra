import React from 'react';
import { caseStatusAppearance } from '../../lib/designTokens';
import './layoutPrimitives.css';

export const StatusBadge = ({ status }) => {
  const normalizedStatus = String(status ?? '')
    .trim()
    .toUpperCase();

  const appearance = caseStatusAppearance[normalizedStatus] || {
    label: normalizedStatus ? normalizedStatus.replaceAll('_', ' ') : 'Unknown',
    tone: 'neutral',
  };

  return <span className={`status-badge status-badge--${appearance.tone}`}>{appearance.label}</span>;
};
