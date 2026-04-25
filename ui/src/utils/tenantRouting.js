const FIRM_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED_SLUGS = new Set(['app', 'superadmin', 'login']);

export const sanitizeFirmSlug = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;
  if (!FIRM_SLUG_PATTERN.test(normalized)) return null;
  if (RESERVED_SLUGS.has(normalized)) return null;
  return normalized;
};

export const resolveFirmLoginPath = ({ firmSlug, fallbackFirmSlug } = {}) => {
  const resolvedFirmSlug = sanitizeFirmSlug(firmSlug) || sanitizeFirmSlug(fallbackFirmSlug);

  if (!resolvedFirmSlug) {
    return '/login';
  }

  return `/${resolvedFirmSlug}/login`;
};
