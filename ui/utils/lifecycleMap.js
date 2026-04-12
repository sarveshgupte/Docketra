export const lifecycleMeta = {
  open_active: { label: 'Active', color: 'blue', icon: '◉' },
  in_progress: { label: 'In Progress', color: 'amber', icon: '↻' },
  blocked: { label: 'Blocked', color: 'red', icon: '⛔' },
  completed: { label: 'Completed', color: 'green', icon: '✓' },
};

const COLOR_STYLES = {
  blue: { bg: '#eff6ff', fg: '#1d4ed8', border: '#bfdbfe' },
  amber: { bg: '#fffbeb', fg: '#b45309', border: '#fde68a' },
  red: { bg: '#fef2f2', fg: '#b91c1c', border: '#fecaca' },
  green: { bg: '#ecfdf5', fg: '#047857', border: '#a7f3d0' },
};

const DEFAULT_LIFECYCLE_KEY = 'open_active';

/** Map API / legacy values to a canonical lifecycleMeta key. Unknown values fall back to open_active. */
export function resolveLifecycleKey(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return DEFAULT_LIFECYCLE_KEY;
  const lower = s.toLowerCase().replace(/-/g, '_');
  if (lifecycleMeta[lower]) return lower;

  const legacyUpper = s.toUpperCase();
  const fromLegacy = {
    CREATED: 'open_active',
    UNASSIGNED: 'open_active',
    ASSIGNED: 'open_active',
    IN_WORKLIST: 'open_active',
    OPEN: 'open_active',
    ACTIVE: 'open_active',
    IN_PROGRESS: 'in_progress',
    PENDING: 'blocked',
    PENDED: 'blocked',
    BLOCKED: 'blocked',
    ON_HOLD: 'blocked',
    QC_PENDING: 'blocked',
    QC_FAILED: 'blocked',
    QC_CORRECTED: 'in_progress',
    RESOLVED: 'completed',
    CLOSED: 'completed',
    FILED: 'completed',
    ARCHIVED: 'completed',
    COMPLETED: 'completed',
  };

  const mapped = fromLegacy[legacyUpper];
  return mapped && lifecycleMeta[mapped] ? mapped : DEFAULT_LIFECYCLE_KEY;
}

export function getLifecycleMeta(raw) {
  const key = resolveLifecycleKey(raw);
  return { key, ...lifecycleMeta[key] };
}

export function getLifecycleBadgePalette(color) {
  return COLOR_STYLES[color] || COLOR_STYLES.blue;
}
