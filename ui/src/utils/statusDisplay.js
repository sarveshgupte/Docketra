const STATUS_EMOJI = {
  OPEN: '🟢',
  IN_PROGRESS: '🟡',
  RESOLVED: '🔵',
  CLOSED: '⚫',
};

const STATUS_COPY = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

const normalizeStatus = (status) => {
  const normalizedStatus = String(status ?? '').trim().toUpperCase();
  if (!normalizedStatus) return 'OPEN';
  if (normalizedStatus === 'PENDING' || normalizedStatus === 'PENDED' || normalizedStatus === 'QC_PENDING') return 'IN_PROGRESS';
  if (normalizedStatus === 'FILED') return 'CLOSED';
  if (STATUS_COPY[normalizedStatus]) return normalizedStatus;
  return 'OPEN';
};

export const getStatusLabel = (status) => {
  const normalized = normalizeStatus(status);
  return `${STATUS_EMOJI[normalized]} ${STATUS_COPY[normalized]}`;
};
