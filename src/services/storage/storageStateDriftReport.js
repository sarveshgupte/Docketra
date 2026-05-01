const { normalizeProvider } = require('./resolveFirmStorageState');

function getStorageStateDriftIssues(firm) {
  const issues = [];
  const mode = String(firm?.storage?.mode || 'docketra_managed');
  const configProvider = normalizeProvider(firm?.storageConfig?.provider);
  const legacyProvider = normalizeProvider(firm?.storage?.provider);

  if (mode === 'firm_connected' && !configProvider) issues.push('FIRM_CONNECTED_WITHOUT_STORAGECONFIG_PROVIDER');
  if (legacyProvider === 'google_drive' && !configProvider) issues.push('LEGACY_PROVIDER_WITHOUT_STORAGECONFIG_PROVIDER');
  if (configProvider === 'google_drive' && !legacyProvider) issues.push('STORAGECONFIG_PROVIDER_WITHOUT_LEGACY_PROVIDER');
  if (firm?.storage?.provider === 'google-drive') issues.push('LEGACY_GOOGLE_DASH_NAMING');
  if (firm?.storage?.provider === 'docketra_drive' || firm?.storageConfig?.provider === 'docketra_drive') issues.push('LEGACY_DOCKETRA_DRIVE_ALIAS');

  return issues;
}

module.exports = { getStorageStateDriftIssues };
