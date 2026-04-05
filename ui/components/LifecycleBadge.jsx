import React from 'react';
import { getLifecycleBadgePalette, getLifecycleMeta } from '../utils/lifecycleMap';

/** Renders nothing when lifecycle cannot be resolved — never shows "Unknown". */
export function LifecycleBadge({ lifecycle, className = '' }) {
  const meta = getLifecycleMeta(lifecycle);
  if (!meta) return null;
  const palette = getLifecycleBadgePalette(meta.color);
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 10px',
        borderRadius: 9999,
        fontSize: '0.75rem',
        fontWeight: 600,
        backgroundColor: palette.bg,
        color: palette.fg,
        border: `1px solid ${palette.border}`,
      }}
    >
      {meta.label}
    </span>
  );
}
