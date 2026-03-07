export const resolveFirmLoginPath = ({ firmSlug, fallbackFirmSlug } = {}) => {
  const resolvedFirmSlug = firmSlug || fallbackFirmSlug;

  if (!resolvedFirmSlug) {
    return '/superadmin';
  }

  return `/${resolvedFirmSlug}/login`;
};
