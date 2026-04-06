import React from 'react';
import { LifecycleBadge } from './LifecycleBadge';
import { formatCaseName, formatDate, formatDocketId } from '../src/utils/formatters';

const cardStyle = {
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: '16px 18px',
  background: '#fff',
  cursor: 'pointer',
  textAlign: 'left',
  width: '100%',
  transition: 'box-shadow 0.15s ease, border-color 0.15s ease, transform 0.1s ease, opacity 0.1s ease',
};

export function DocketCard({
  docketId,
  title,
  lifecycle,
  assignedTo,
  assignedToName,
  assignedToXID,
  lastUpdated,
  onOpen,
  focused = false,
  isOpening = false,
}) {
  const asDisplayValue = (value) => (!value || value === 'N/A' ? '—' : value);
  const displayDocketId = formatDocketId(docketId);
  const displayTitle = asDisplayValue(formatCaseName(title));
  const lastUpdatedLabel = asDisplayValue(formatDate(lastUpdated));
  const isWorklistLifecycle = String(lifecycle || '').trim().toUpperCase() === 'WL'
    || String(lifecycle || '').trim().toLowerCase() === 'in_worklist';
  const normalizedAssignedTo = String(assignedTo || '').trim();
  const normalizedAssignedToName = String(assignedToName || '').trim();
  const normalizedAssignedToXID = String(assignedToXID || '').trim();
  const assignmentDisplay = normalizedAssignedToName || normalizedAssignedToXID || normalizedAssignedTo || (isWorklistLifecycle ? '—' : 'Unassigned');

  return (
    <button
      type="button"
      className="docket-card"
      style={{
        ...cardStyle,
        borderColor: focused ? '#93c5fd' : '#e5e7eb',
        outline: focused ? '2px solid #2563eb' : 'none',
        outlineOffset: 2,
        boxShadow: focused ? '0 1px 6px rgba(37, 99, 235, 0.2)' : 'none',
        opacity: isOpening ? 0.85 : 1,
        transform: isOpening ? 'scale(0.995)' : 'none',
      }}
      onClick={() => onOpen?.(docketId)}
      aria-label={`Open docket ${displayDocketId}`}
      aria-pressed={isOpening}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0, display: 'grid', gap: 4 }}>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, letterSpacing: '0.03em' }}>{displayDocketId}</div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {displayTitle === '—' ? 'Untitled docket' : displayTitle}
          </div>
        </div>
        <LifecycleBadge lifecycle={lifecycle} />
      </div>

      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, color: '#374151', fontSize: '0.84rem' }}>
        <span aria-hidden="true">👤</span>
        <span style={{ fontWeight: 500 }}>{assignmentDisplay}</span>
      </div>

      <div style={{ marginTop: 8, fontSize: '0.75rem', color: '#9ca3af' }}>
        Last updated: {lastUpdatedLabel}
      </div>
    </button>
  );
}
