import { useEffect, useMemo, useState } from 'react';
import { getStorageConfiguration, getStorageOwnershipSummary, getStorageRootHealth } from '../services/storageService';
import { buildStorageStatusSummary } from './storageStatusSummaryLogic';

const CACHE_TTL_MS = 60 * 1000;
const statusCache = new Map();

const resolveSettledValue = (result, fallback) => (
  result?.status === 'fulfilled' ? (result.value || fallback) : fallback
);

const isAccessDenied = (result) => [401, 403].includes(Number(result?.reason?.response?.status));

export default function useStorageStatusSummary(firmSlug, options = {}) {
  const {
    includeOwnershipSummary = true,
    includeRootHealth = true,
  } = options;
  const cacheKey = `${firmSlug || ''}:${includeOwnershipSummary ? 'ownership' : 'no-ownership'}:${includeRootHealth ? 'root' : 'no-root'}`;
  const [state, setState] = useState(() => ({ loading: Boolean(firmSlug), ...buildStorageStatusSummary(firmSlug || '', {}, {}, null) }));

  useEffect(() => {
    if (!firmSlug) {
      setState({ loading: false, ...buildStorageStatusSummary('', {}, {}, null) });
      return;
    }

    const cached = statusCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
      setState({ ...cached.data, loading: false });
      return;
    }

    let active = true;
    setState((prev) => ({ ...prev, loading: true }));

    Promise.allSettled([
      getStorageConfiguration(),
      includeOwnershipSummary ? getStorageOwnershipSummary() : Promise.resolve({}),
      includeRootHealth ? getStorageRootHealth() : Promise.resolve({}),
    ])
      .then(([configurationResult, ownershipResult, rootHealthResult]) => {
        if (!active) return;
        const configuration = resolveSettledValue(configurationResult, {});
        const ownershipResponse = resolveSettledValue(ownershipResult, {});
        const ownershipSummary = ownershipResponse?.data && typeof ownershipResponse.data === 'object'
          ? ownershipResponse.data
          : ownershipResponse;
        const activeStorage = ownershipSummary?.activeStorage && typeof ownershipSummary.activeStorage === 'object'
          ? ownershipSummary.activeStorage
          : null;
        const rootHealth = resolveSettledValue(rootHealthResult, {});
        const configurationError = configurationResult.status === 'rejected'
          && configurationResult.reason?.response?.status !== 404
          ? configurationResult.reason
          : null;
        const nonBlockingAccessError = isAccessDenied(ownershipResult) || isAccessDenied(rootHealthResult);
        const nextState = buildStorageStatusSummary(
          firmSlug,
          configuration,
          activeStorage ? { ...ownershipSummary, activeStorage } : ownershipSummary,
          rootHealth,
          nonBlockingAccessError ? null : configurationError,
        );
        statusCache.set(cacheKey, { data: nextState, timestamp: Date.now() });
        setState(nextState);
      })
      .catch((err) => {
        if (!active) return;
        const nonBlockingError = err?.response?.status === 404 ? null : err;
        const nextState = buildStorageStatusSummary(firmSlug, {}, {}, {}, nonBlockingError);
        setState(nextState);
      });

    return () => { active = false; };
  }, [firmSlug, cacheKey, includeOwnershipSummary, includeRootHealth]);

  return useMemo(() => state, [state]);
}
