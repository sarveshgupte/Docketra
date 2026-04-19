/**
 * Resolves the backend origin used for cross-origin auth redirects.
 * We intentionally require an explicit VITE_API_BASE_URL so the browser never
 * builds a relative URL (which can be captured by firm-scoped frontend routes).
 */
export function getApiBaseUrl() {
  const rawApiBase = String(import.meta.env.VITE_API_BASE_URL || '').trim();
  if (!rawApiBase) {
    // eslint-disable-next-line no-console
    console.error('[OAuth] VITE_API_BASE_URL is missing. Google OAuth redirect aborted.');
    return null;
  }

  return rawApiBase.replace(/\/+$/, '');
}

export default getApiBaseUrl;
