import React from 'react';
import { getLifecycleBadgePalette, getLifecycleMeta } from '../utils/lifecycleMap';

export function LifecycleBadge({ lifecycle, className = '' }) {
  const meta = getLifecycleMeta(lifecycle);
  const palette = getLifecycleBadgePalette(meta.color);

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignSelf: 'flex-start',
        width: 'fit-content',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 9999,
        fontSize: '0.75rem',
        fontWeight: 600,
        backgroundColor: palette.bg,
        color: palette.fg,
        border: `1px solid ${palette.border}`,
        whiteSpace: 'nowrap',
      }}
      title={`Lifecycle: ${meta.label}`}
      aria-label={`Lifecycle: ${meta.label}`}
    >
      <span aria-hidden="true" style={{ fontSize: '0.7rem' }}>{meta.icon}</span>
      <span>{meta.label}</span>
    </span>
  );
}
