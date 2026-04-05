import React from 'react';
import { LifecycleBadge } from './LifecycleBadge';
import { formatDate } from '../src/utils/formatters';

const cardStyle = {
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: '16px 18px',
  background: '#fff',
  cursor: 'pointer',
  textAlign: 'left',
  width: '100%',
  transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
};

export function DocketCard({
  docketId,
  title,
  lifecycle,
  assignedTo,
  lastUpdated,
  onOpen,
  focused = false,
}) {
  return (
    <button
      type="button"
      className="docket-card"
      style={{
        ...cardStyle,
        outline: focused ? '2px solid #2563eb' : 'none',
        outlineOffset: 2,
        boxShadow: focused ? '0 1px 6px rgba(37, 99, 235, 0.2)' : 'none',
      }}
      onClick={() => onOpen?.(docketId)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 500 }}>{docketId}</div>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: '#111827', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title || '—'}
          </div>
        </div>
        {lifecycle != null && lifecycle !== '' ? <LifecycleBadge lifecycle={lifecycle} /> : null}
      </div>
      {assignedTo != null && assignedTo !== '' ? (
        <div style={{ marginTop: 12, fontSize: '0.85rem', color: '#4b5563' }}>
          <span>{assignedTo}</span>
        </div>
      ) : null}
      <div style={{ marginTop: 8, fontSize: '0.75rem', color: '#9ca3af' }}>
        Last updated {lastUpdated ? formatDate(lastUpdated) : '—'}
      </div>
    </button>
  );
}
