/**
 * StorageFactory
 *
 * Returns the appropriate StorageProvider instance for the given
 * provider name.  New providers are wired in here only — no
 * provider-selection logic should exist elsewhere in the codebase.
 */

const GoogleDriveProvider = require('./providers/GoogleDriveProvider');

const PROVIDERS = {
  google: (oauthClient) => new GoogleDriveProvider(oauthClient || null),
};

/**
 * Return an instantiated StorageProvider for the requested backend.
 *
 * @param {string} providerName  - e.g. "google"
 * @param {object} [oauthClient] - Optional authenticated OAuth2 client (used by Google provider)
 * @returns {import('./StorageProvider.interface').StorageProvider}
 * @throws {Error} if the provider name is not recognised
 */
function getStorageProvider(providerName, oauthClient) {
  const factory = PROVIDERS[providerName];
  if (!factory) {
    throw new Error(
      `Unknown storage provider: "${providerName}". ` +
      `Supported providers: ${Object.keys(PROVIDERS).join(', ')}`
    );
  }
  return factory(oauthClient);
}

module.exports = { getStorageProvider };
