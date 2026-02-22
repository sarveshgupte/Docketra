/**
 * StorageFactory
 *
 * Returns the appropriate StorageProvider instance for the given
 * provider name.  New providers are wired in here only — no
 * provider-selection logic should exist elsewhere in the codebase.
 */

const GoogleDriveProvider = require('./providers/GoogleDriveProvider');

const PROVIDERS = {
  google: () => new GoogleDriveProvider(),
};

/**
 * Return an instantiated StorageProvider for the requested backend.
 *
 * @param {string} providerName  - e.g. "google"
 * @returns {import('./StorageProvider.interface').StorageProvider}
 * @throws {Error} if the provider name is not recognised
 */
function getStorageProvider(providerName) {
  const factory = PROVIDERS[providerName];
  if (!factory) {
    throw new Error(
      `Unknown storage provider: "${providerName}". ` +
      `Supported providers: ${Object.keys(PROVIDERS).join(', ')}`
    );
  }
  return factory();
}

module.exports = { getStorageProvider };
