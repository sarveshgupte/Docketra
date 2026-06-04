import { ROUTES } from '../constants/routes.js';

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

const getOwnershipActiveStorage = (ownershipSummary = {}) => (
  ownershipSummary?.activeStorage && typeof ownershipSummary.activeStorage === 'object'
    ? ownershipSummary.activeStorage
    : {}
);

export const buildStorageStatusSummary = (firmSlug, configuration = {}, ownershipSummary = {}, rootHealth = {}, error = null) => {
  const activeStorage = getOwnershipActiveStorage(ownershipSummary);
  const provider = normalizeProvider(
    configuration.provider
    || activeStorage.provider
    || ownershipSummary.provider
    || ownershipSummary.activeProvider
    || ownershipSummary.activeStorageProvider
  );
  const configurationStatus = normalizeStatus(configuration.status);
  const healthStatus = normalizeStatus(ownershipSummary?.lastHealthCheck?.status || activeStorage.connectionStatus);
  const strictMode = isStrictMode(configuration, ownershipSummary);
  const activeConnectionStatus = normalizeStatus(activeStorage.connectionStatus);

  const byosConfigured = Boolean(provider === 'google_drive' || activeConnectionStatus === 'ACTIVE_BYOS');
  const byosProvider = provider === 'google_drive';
  const needsAttention = Boolean(
    ['ERROR', 'DISCONNECTED'].includes(configurationStatus)
    || ['ERROR', 'DISCONNECTED'].includes(healthStatus)
    || ['ERROR', 'DISCONNECTED'].includes(activeConnectionStatus)
    || error
    || (rootHealth?.status === 'recovery_required' && (strictMode || byosConfigured || byosProvider))
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
    helperText = rootHealth?.status === 'recovery_required' ? 'Google Drive root recovery required' : 'Storage connection requires attention from a Primary Admin.';
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

  const activeFirmSlug = String(firmSlug || '');

  return {
    loading: false,
    error,
    mode: configuration.mode || ownershipSummary.mode || (byosActive ? 'firm_owned' : 'docketra_managed'),
    provider,
    badgeTone,
    badgeLabel,
    providerLabel,
    connectedEmail: sanitizeEmail(configuration.connectedEmail || activeStorage.connectedEmail || ownershipSummary.connectedEmail),
    lastCheckedAt: ownershipSummary?.lastHealthCheck?.checkedAt || activeStorage.lastCheckedAt || configuration.updatedAt || null,
    businessDataLocation,
    helperText,
    statusLabel,
    storageSettingsPath: ROUTES.STORAGE_SETTINGS(activeFirmSlug),
    dataStorageMapPath: ROUTES.DATA_STORAGE_MAP(activeFirmSlug),
    isByosActive: byosActive,
    isManagedFallback: managedFallback,
    needsAttention,
    isStrictMode: strictMode,
  };
};
