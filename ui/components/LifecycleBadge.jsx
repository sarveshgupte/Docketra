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
        gap: 4,
        padding: '1.5px 6px',
        borderRadius: 2,
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        fontFamily: 'ui-monospace, monospace',
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
