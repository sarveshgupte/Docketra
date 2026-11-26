/**
 * Determines whether non-Google storage options (local PC/network paths in
 * onboarding and OneDrive/AWS S3 in settings) should be surfaced.
 * Live production (`main`) restricts to Google Drive, while CUG keeps them enabled.
 */
export const isAlternativeStorageEnabled = ({
  env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {},
  hostname = typeof window !== 'undefined' ? window.location?.hostname : '',
} = {}) => {
  const explicitFlag = String(env?.VITE_ENABLE_ALT_STORAGE || '').trim().toLowerCase();
  if (explicitFlag === 'true') return true;
  if (explicitFlag === 'false') return false;

  const apiBase = String(env?.VITE_API_BASE_URL || '').trim().toLowerCase();
  const host = String(hostname || '').trim().toLowerCase();
  return (
    host.includes('-cug')
    || host.startsWith('cug.')
    || apiBase.includes('-cug')
    || apiBase.includes('cug-api.')
  );
};
