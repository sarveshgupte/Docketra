const ONBOARDING_MUTATION_METHODS = new Set(['post', 'put', 'patch', 'delete']);

export const ONBOARDING_PROGRESS_REFRESH_EVENT = 'docketra:onboarding-progress-refresh';

const ONBOARDING_REFRESH_PATH_PATTERNS = [
  /^\/admin\/firm-settings(?:\/|$)/,
  /^\/firm\/storage\/change(?:\/|$)/,
  /^\/admin\/storage(?:\/|$)/,
  /^\/admin\/clients(?:\/|$)/,
  /^\/admin\/categories(?:\/|$)/,
  /^\/admin\/workbaskets(?:\/|$)/,
  /^\/admin\/users(?:\/|$)/,
  /^\/dockets(?:\/|$)/,
];

const normalizeRequestPath = (rawUrl = '') => {
  const withoutDomain = String(rawUrl || '').replace(/^https?:\/\/[^/]+/i, '');
  const withoutQuery = withoutDomain.split('?')[0] || '';
  return withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;
};

export const shouldRefreshOnboardingProgress = ({ method, url }) => {
  const normalizedMethod = String(method || '').toLowerCase();
  if (!ONBOARDING_MUTATION_METHODS.has(normalizedMethod)) {
    return false;
  }

  const normalizedPath = normalizeRequestPath(url);
  return ONBOARDING_REFRESH_PATH_PATTERNS.some((pattern) => pattern.test(normalizedPath));
};

let lastEmittedAt = 0;
const EMIT_THROTTLE_MS = 500;

export const emitOnboardingProgressRefresh = (detail = {}) => {
  if (typeof window === 'undefined') return false;

  const now = Date.now();
  if (now - lastEmittedAt < EMIT_THROTTLE_MS) {
    return false;
  }

  lastEmittedAt = now;
  window.dispatchEvent(new CustomEvent(ONBOARDING_PROGRESS_REFRESH_EVENT, { detail: { ...detail, emittedAt: now } }));
  return true;
};
