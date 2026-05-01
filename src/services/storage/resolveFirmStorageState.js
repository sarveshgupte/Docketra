const { decrypt } = require('./services/TokenEncryption.service');

const MANAGED_MODE = 'docketra_managed';

function normalizeProvider(raw) {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return null;
  if (value === 'google-drive' || value === 'google_drive') return 'google_drive';
  if (value === 'docketra_drive' || value === 'docketra_managed') return 'docketra_managed';
  return value;
}

function decodeCredentials(encryptedBlob) {
  if (!encryptedBlob) return { credentials: null, decryptError: null };
  try {
    return { credentials: JSON.parse(decrypt(encryptedBlob)), decryptError: null };
  } catch (error) {
    return { credentials: null, decryptError: error };
  }
}

function resolveFirmStorageState(firm, options = {}) {
  const warnings = [];
  const mode = String(firm?.storage?.mode || MANAGED_MODE);
  const configProvider = normalizeProvider(firm?.storageConfig?.provider);
  const legacyProvider = normalizeProvider(firm?.storage?.provider);
  const hasStorageConfig = Boolean(configProvider);

  if (!configProvider && legacyProvider) warnings.push('storage.provider is set without storageConfig.provider; using legacy compatibility fallback');
  if (firm?.storage?.provider === 'google-drive') warnings.push('legacy google-drive provider normalized to google_drive');
  if (firm?.storage?.provider === 'docketra_drive' || firm?.storageConfig?.provider === 'docketra_drive') warnings.push('legacy docketra_drive alias normalized to docketra_managed');
  if (mode === 'firm_connected' && !configProvider && !legacyProvider) warnings.push('firm is marked firm_connected but no usable provider is configured');

  const canonicalProvider = configProvider || legacyProvider || (mode === MANAGED_MODE ? 'docketra_managed' : null);
  const isManaged = canonicalProvider === 'docketra_managed';
  const isFirmConnected = Boolean(canonicalProvider) && !isManaged;

  const { credentials, decryptError } = decodeCredentials(firm?.storageConfig?.credentials);
  if (decryptError) warnings.push('failed to decode storageConfig.credentials');

  const credsStatus = String(credentials?.status || '').toUpperCase();
  const hasLegacyRefreshToken = Boolean(firm?.storage?.google?.encryptedRefreshToken);
  const hasLegacyGoogleUsable = canonicalProvider === 'google_drive' && hasLegacyRefreshToken
    && Boolean(firm?.storage?.google?.rootFolderId || credentials?.rootFolderId);

  const hasUsableCredentialsByProvider = (() => {
    if (!isFirmConnected) return false;
    if (canonicalProvider === 'google_drive') {
      return Boolean((credentials?.refreshToken || credentials?.googleRefreshToken) && credentials?.rootFolderId) || hasLegacyGoogleUsable;
    }
    if (canonicalProvider === 'onedrive') return Boolean(credentials?.refreshToken);
    if (canonicalProvider === 's3') return Boolean(credentials?.bucket && credentials?.region);
    return false;
  })();

  const hasCredentials = hasUsableCredentialsByProvider || hasLegacyRefreshToken || Boolean(firm?.storageConfig?.credentials);

  let connectionStatus = 'DISCONNECTED';
  if (isManaged) {
    connectionStatus = 'ACTIVE_MANAGED';
  } else if (decryptError || credsStatus === 'ERROR') {
    connectionStatus = 'ERROR';
  } else if (credsStatus === 'DISCONNECTED') {
    connectionStatus = 'DISCONNECTED';
  } else if (isFirmConnected && hasUsableCredentialsByProvider) {
    connectionStatus = 'ACTIVE_BYOS';
  }

  return {
    mode,
    provider: canonicalProvider,
    canonicalProvider,
    isManaged,
    isFirmConnected,
    connectionStatus,
    hasStorageConfig,
    hasCredentials,
    rootFolderId: credentials?.rootFolderId || firm?.storage?.google?.rootFolderId || null,
    driveId: credentials?.driveId || null,
    connectedEmail: credentials?.connectedEmail || null,
    lastError: credentials?.lastError || null,
    lastCheckedAt: credentials?.lastCheckedAt || null,
    source: configProvider ? 'storageConfig.provider' : (legacyProvider ? 'storage.provider' : 'storage.mode'),
    warnings,
    ...(options.includeCredentials ? { credentials } : {}),
  };
}

module.exports = { resolveFirmStorageState, normalizeProvider };
