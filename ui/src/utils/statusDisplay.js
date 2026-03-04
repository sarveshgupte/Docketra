import { UX_COPY } from '../constants/uxCopy';

export const getStatusLabel = (status) => {
  const normalizedStatus = String(status ?? '').trim().toUpperCase();
  if (!normalizedStatus) return 'Unknown';
  return UX_COPY.statusLabels[normalizedStatus] || normalizedStatus.replaceAll('_', ' ');
};
