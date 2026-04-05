export const lifecycleMeta = {
  created: { label: 'Created', color: 'gray' },
  in_worklist: { label: 'In Worklist', color: 'blue' },
  active: { label: 'Active', color: 'green' },
  completed: { label: 'Completed', color: 'purple' },
  archived: { label: 'Archived', color: 'dark' },
};

const COLOR_STYLES = {
  gray: { bg: '#f3f4f6', fg: '#374151', border: '#e5e7eb' },
  blue: { bg: '#eff6ff', fg: '#1d4ed8', border: '#bfdbfe' },
  green: { bg: '#ecfdf5', fg: '#047857', border: '#a7f3d0' },
  purple: { bg: '#faf5ff', fg: '#6b21a8', border: '#e9d5ff' },
  dark: { bg: '#f9fafb', fg: '#111827', border: '#d1d5db' },
};

/** Map API / legacy values to a canonical lifecycleMeta key, or null if unknown. */
export function resolveLifecycleKey(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const lower = s.toLowerCase().replace(/-/g, '_');
  if (lifecycleMeta[lower]) return lower;

  const legacyUpper = s.toUpperCase();
  const fromLegacy = {
    CREATED: 'created',
    UNASSIGNED: 'created',
    ASSIGNED: 'in_worklist',
    IN_WORKLIST: 'in_worklist',
    OPEN: 'active',
    IN_PROGRESS: 'active',
    PENDING: 'active',
    PENDED: 'active',
    QC_PENDING: 'active',
    QC_FAILED: 'active',
    QC_CORRECTED: 'active',
    RESOLVED: 'completed',
    CLOSED: 'completed',
    FILED: 'archived',
    ARCHIVED: 'archived',
    COMPLETED: 'completed',
    ACTIVE: 'active',
  };
  const mapped = fromLegacy[legacyUpper];
  return mapped && lifecycleMeta[mapped] ? mapped : null;
}

export function getLifecycleMeta(raw) {
  const key = resolveLifecycleKey(raw);
  if (!key) return null;
  return { key, ...lifecycleMeta[key] };
}

export function getLifecycleBadgePalette(color) {
  return COLOR_STYLES[color] || COLOR_STYLES.gray;
}
