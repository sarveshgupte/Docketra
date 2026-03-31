const CASE_CACHE_TTL_MS = 30 * 1000;
const caseCache = new Map();

const makeCaseCacheKey = (caseId, params = {}) => `${caseId}:${JSON.stringify(params)}`;

export const getCachedCase = (caseId, params = {}) => {
  const key = makeCaseCacheKey(caseId, params);
  const cached = caseCache.get(key);

  if (!cached) return null;
  if (cached.promise) return cached.promise;

  if ((Date.now() - cached.ts) > CASE_CACHE_TTL_MS) {
    caseCache.delete(key);
    return null;
  }

  return cached.value;
};

export const setCachedCase = (caseId, params, value) => {
  const key = makeCaseCacheKey(caseId, params);
  caseCache.set(key, { value, ts: Date.now() });
};

export const setPendingCasePromise = (caseId, params, promise) => {
  const key = makeCaseCacheKey(caseId, params);
  caseCache.set(key, { promise, ts: Date.now() });
};

export const clearPendingCasePromise = (caseId, params) => {
  const key = makeCaseCacheKey(caseId, params);
  caseCache.delete(key);
};

export const invalidateCaseCache = (caseId) => {
  const prefix = `${caseId}:`;
  for (const key of caseCache.keys()) {
    if (key.startsWith(prefix)) {
      caseCache.delete(key);
    }
  }
};
