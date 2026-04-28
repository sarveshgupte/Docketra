export const resolveCrmErrorMessage = (error, fallbackMessage) => {
  const message = String(error?.message || '').trim();
  if (!message) return fallbackMessage;

  const normalized = message.toLowerCase();
  const isFirmResolutionMessage =
    normalized.includes('firm not found')
    || normalized.includes('check your login url')
    || normalized.includes('failed to resolve firm context')
    || normalized.includes('tenant context missing');

  if (isFirmResolutionMessage) {
    return fallbackMessage;
  }

  return message;
};

export const normalizeRows = (payload) => {
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

export const formatRelativeDateLabel = (value, referenceDate = new Date()) => {
  if (!value) return 'Not scheduled';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not scheduled';

  const now = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  if (Number.isNaN(now.getTime())) return 'Not scheduled';
  const dayMs = 24 * 60 * 60 * 1000;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((startOfTarget - startOfToday) / dayMs);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`;
  return `In ${diffDays} days`;
};
