import React from 'react';
import { caseStatusAppearance } from '../../lib/designTokens';
import { getStatusLabel } from '../../utils/statusDisplay';
import './layoutPrimitives.css';

export const StatusBadge = ({ status }) => {
  const normalizedStatus = String(status ?? '')
    .trim()
    .toUpperCase();

  const appearance = caseStatusAppearance[normalizedStatus] || {
    label: getStatusLabel(normalizedStatus),
    tone: 'neutral',
  };

  return <span className={`status-badge status-badge--${appearance.tone}`}>{appearance.label}</span>;
};
