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
