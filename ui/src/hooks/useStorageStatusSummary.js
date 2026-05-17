import { useEffect, useMemo, useState } from 'react';
import { ROUTES } from '../constants/routes';
import { getStorageConfiguration, getStorageOwnershipSummary } from '../services/storageService';

const CACHE_TTL_MS = 60 * 1000;
const statusCache = new Map();

const SANITIZED_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeProvider = (provider) => String(provider || '').toLowerCase().replace(/-/g, '_');
const normalizeStatus = (status) => String(status || '').toUpperCase();
const isStrictMode = (configuration, summary) => Boolean(
  configuration?.strictFirmOwnedStorage
  || configuration?.strictFirmOwnedStorageMode
  || summary?.strictFirmOwnedStorage
  || summary?.strictFirmOwnedStorageMode
  || configuration?.storagePolicy?.mode === 'strict_firm_owned'
  || summary?.storagePolicy?.mode === 'strict_firm_owned'
);

const sanitizeEmail = (email) => {
  if (!email || typeof email !== 'string') return null;
  const trimmed = email.trim();
  return SANITIZED_EMAIL_REGEX.test(trimmed) ? trimmed : null;
};

const buildSummary = (firmSlug, configuration = {}, ownershipSummary = {}, error = null) => {
  const provider = normalizeProvider(configuration.provider || ownershipSummary.provider || ownershipSummary.activeProvider);
  const configurationStatus = normalizeStatus(configuration.status);
  const healthStatus = normalizeStatus(ownershipSummary?.lastHealthCheck?.status);
  const strictMode = isStrictMode(configuration, ownershipSummary);

  const byosConfigured = Boolean(configuration?.isConfigured);
  const byosProvider = provider === 'google_drive';
  const needsAttention = Boolean(
    ['ERROR', 'DISCONNECTED'].includes(configurationStatus)
    || ['ERROR', 'DISCONNECTED'].includes(healthStatus)
    || error
  );

  const byosActive = byosProvider && byosConfigured && !needsAttention;
  const managedFallback = !byosActive && !needsAttention;

  let badgeTone = 'neutral';
  let badgeLabel = 'Docketra-managed storage';
  let providerLabel = 'Docketra-managed Google Drive';
  let businessDataLocation = 'Docketra-managed storage';
  let helperText = 'Business files currently use Docketra-managed storage.';
  let statusLabel = 'Active';

  if (needsAttention) {
    badgeTone = 'warning';
    badgeLabel = 'Storage needs attention';
    providerLabel = byosProvider ? 'Firm-owned Google Drive' : 'Docketra-managed Google Drive';
    helperText = 'Storage connection requires attention from a Primary Admin.';
    statusLabel = 'Needs attention';
  } else if (strictMode && byosActive) {
    badgeTone = 'success';
    badgeLabel = 'Strict firm-owned storage';
    providerLabel = 'Firm-owned Google Drive';
    businessDataLocation = 'Firm-owned cloud storage';
    helperText = 'Docketra-managed fallback storage is disabled for this workspace.';
  } else if (byosActive) {
    badgeTone = 'success';
    badgeLabel = 'Firm-owned storage active';
    providerLabel = 'Firm-owned Google Drive';
    businessDataLocation = 'Firm-owned cloud storage';
    helperText = 'Business files are stored in your firm-owned Google Drive.';
  }

  return {
    loading: false,
    error,
    mode: configuration.mode || ownershipSummary.mode || (byosActive ? 'firm_owned' : 'docketra_managed'),
    provider,
    badgeTone,
    badgeLabel,
    providerLabel,
    connectedEmail: sanitizeEmail(configuration.connectedEmail || ownershipSummary.connectedEmail),
    lastCheckedAt: ownershipSummary?.lastHealthCheck?.checkedAt || configuration.updatedAt || null,
    businessDataLocation,
    helperText,
    statusLabel,
    storageSettingsPath: ROUTES.STORAGE_SETTINGS(firmSlug),
    dataStorageMapPath: ROUTES.DATA_STORAGE_MAP(firmSlug),
    isByosActive: byosActive,
    isManagedFallback: managedFallback,
    needsAttention,
    isStrictMode: strictMode,
  };
};

export default function useStorageStatusSummary(firmSlug) {
  const [state, setState] = useState(() => ({ loading: Boolean(firmSlug), ...buildSummary(firmSlug || '', {}, {}, null) }));

  useEffect(() => {
    if (!firmSlug) {
      setState({ loading: false, ...buildSummary('', {}, {}, null) });
      return;
    }

    const cached = statusCache.get(firmSlug);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
      setState({ ...cached.data, loading: false });
      return;
    }

    let active = true;
    setState((prev) => ({ ...prev, loading: true }));

    Promise.allSettled([getStorageConfiguration(), getStorageOwnershipSummary()])
      .then(([configurationResult, ownershipResult]) => {
        if (!active) return;

        const configuration = configurationResult?.status === 'fulfilled' ? configurationResult.value : {};
        const ownershipSummary = ownershipResult?.status === 'fulfilled' ? ownershipResult.value : {};

        const configurationError = configurationResult?.status === 'rejected' ? configurationResult.reason : null;
        const ownershipError = ownershipResult?.status === 'rejected' ? ownershipResult.reason : null;

        const nonBlockingConfigurationError = configurationError?.response?.status === 404 ? null : configurationError;
        const nonBlockingOwnershipError = [403, 404].includes(ownershipError?.response?.status) ? null : ownershipError;
        const blockingError = nonBlockingConfigurationError || nonBlockingOwnershipError;

        const nextState = buildSummary(firmSlug, configuration, ownershipSummary, blockingError);
        statusCache.set(firmSlug, { data: nextState, timestamp: Date.now() });
        setState(nextState);
      });

    return () => { active = false; };
  }, [firmSlug]);

  return useMemo(() => state, [state]);
}
