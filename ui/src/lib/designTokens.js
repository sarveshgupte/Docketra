export const designTokens = {
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },
  typography: {
    pageTitle: '28px',
    sectionTitle: '18px',
    body: '14px',
    caption: '12px',
    semibold: 600,
    medium: 500,
  },
  colors: {
    primary: '#111111',
    accent: '#3b82f6',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    slate900: '#101010',
    border: '#e5e7eb',
    textMain: '#111111',
    textMuted: '#6b7280',
  },
};

export const caseStatusAppearance = {
  OPEN: { label: '🟢 Open', tone: 'open' },
  IN_PROGRESS: { label: '🟡 In Progress', tone: 'review' },
  QC_PENDING: { label: '🔍 QC Pending', tone: 'review' },
  RESOLVED: { label: '🔵 Resolved', tone: 'success' },
  CLOSED: { label: '⚫ Closed', tone: 'closed' },
};
