import { caseStatusAppearance } from '../../lib/designTokens';
import { getStatusLabel } from '../../utils/statusDisplay';
import './layoutPrimitives.css';

export const StatusBadge = ({ status, className = '' }) => {
  const normalizedStatus = String(status ?? '')
    .trim()
    .toUpperCase();

  const appearance = caseStatusAppearance[normalizedStatus] || {
    label: getStatusLabel(normalizedStatus),
    tone: 'neutral',
  };

  return (
    <span
      className={`status-badge status-badge--${appearance.tone} ${className}`.trim()}
      aria-label={`Status: ${appearance.label}`}
    >
      {appearance.label}
    </span>
  );
};
