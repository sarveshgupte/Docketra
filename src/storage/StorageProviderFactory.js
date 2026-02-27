const TenantStorageConfig = require('../models/TenantStorageConfig.model');
const { decrypt } = require('./services/TokenEncryption.service');
const { google } = require('googleapis');
const GoogleDriveProvider = require('./providers/GoogleDriveProvider');
const OneDriveProvider = require('./providers/OneDriveProvider');
const {
  StorageConfigMissingError,
  StorageAccessError,
  UnsupportedProviderError,
} = require('./errors');

function parseRefreshToken(encryptedRefreshToken, tenantId) {
  try {
    return decrypt(encryptedRefreshToken);
  } catch (error) {
    throw new StorageAccessError('Failed to decrypt storage refresh token', tenantId, error);
  }
}

async function getProviderForTenant(tenantId) {
  const config = await TenantStorageConfig.findOne({ tenantId, isActive: true });
  if (!config) {
    throw new StorageConfigMissingError(tenantId);
  }
  if (config.status !== 'ACTIVE') {
    throw new StorageConfigMissingError(tenantId);
  }

  const refreshToken = parseRefreshToken(config.encryptedRefreshToken, tenantId);

  switch (config.provider) {
    case 'google_drive': {
      const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI } = process.env;
      const oauthClient = new google.auth.OAuth2(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        GOOGLE_OAUTH_REDIRECT_URI
      );
      oauthClient.setCredentials({ refresh_token: refreshToken });
      return new GoogleDriveProvider({ oauthClient, driveId: config.driveId });
    }
    case 'onedrive':
      return new OneDriveProvider({ refreshToken, driveId: config.driveId });
    default:
      throw new UnsupportedProviderError(config.provider, tenantId);
  }
}

module.exports = {
  getProviderForTenant,
};
