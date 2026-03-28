/**
 * StorageFactory
 *
 * Returns the appropriate StorageProvider instance for the given
 * provider name.  New providers are wired in here only — no
 * provider-selection logic should exist elsewhere in the codebase.
 */

const GoogleDriveProvider = require('./providers/GoogleDriveProvider');
const OneDriveProvider = require('./providers/OneDriveProvider');

const PROVIDERS = {
  // Keep legacy "google" alias for existing worker job payload compatibility.
  google: (oauthClient, options = {}) => new GoogleDriveProvider({ oauthClient: oauthClient || null, driveId: options.driveId || null }),
  google_drive: (oauthClient, options = {}) => new GoogleDriveProvider({ oauthClient: oauthClient || null, driveId: options.driveId || null }),
  onedrive: (_oauthClient, options = {}) => new OneDriveProvider({ refreshToken: options.refreshToken, driveId: options.driveId }),
};

/**
 * Return an instantiated StorageProvider for the requested backend.
 *
 * @param {string} providerName  - e.g. "google"
 * @param {object} [oauthClient] - Optional authenticated OAuth2 client (used by Google provider)
 * @returns {import('./providers/StorageProvider')}
 * @throws {Error} if the provider name is not recognised
 */
function getStorageProvider(providerName, oauthClient, options = {}) {
  const factory = PROVIDERS[providerName];
  if (!factory) {
    throw new Error(
      `Unknown storage provider: "${providerName}". ` +
      `Supported providers: ${Object.keys(PROVIDERS).join(', ')}`
    );
  }
  return factory(oauthClient, options);
}

module.exports = { getStorageProvider };
