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
      className={`status-badge status-badge--${appearance.tone} border shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)] transition-all duration-200 ease-in-out group-hover:brightness-95 ${className}`}
    >
      {appearance.label}
    </span>
  );
};
