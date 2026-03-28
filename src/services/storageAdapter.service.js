const { google } = require('googleapis');
const Firm = require('../models/Firm.model');
const { decrypt } = require('../services/storage/services/TokenEncryption.service');
const GoogleDriveProvider = require('./storage/providers/GoogleDriveProvider');
const {
  StorageAccessError,
  StorageConfigMissingError,
  UnsupportedProviderError,
} = require('./storage/errors');

class DocketraGoogleAdapter {
  constructor() {
    this.providerName = 'docketra_managed';
  }

  async testConnection() {
    return true;
  }
}

class S3Adapter {
  constructor(credentials = {}) {
    this.providerName = 's3';
    this.credentials = credentials;
  }

  async testConnection() {
    if (!this.credentials?.bucket || !this.credentials?.region) {
      throw new StorageAccessError('S3 credentials are incomplete', 'unknown');
    }
    return true;
  }
}

const buildGoogleDriveAdapter = (config) => {
  let refreshToken = config?.credentials?.googleRefreshToken || null;
  if (!refreshToken && config?.credentials?.encryptedPayload) {
    try {
      const parsed = JSON.parse(decrypt(config.credentials.encryptedPayload));
      refreshToken = parsed?.googleRefreshToken || null;
    } catch (error) {
      throw new StorageAccessError('Unable to decrypt Google Drive credentials', 'unknown', error);
    }
  }
  if (!refreshToken) {
    throw new StorageAccessError('Missing Google Drive refresh token', 'unknown');
  }

  const oauthClient = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT_URI
  );
  oauthClient.setCredentials({ refresh_token: refreshToken.includes(':') ? decrypt(refreshToken) : refreshToken });
  return new GoogleDriveProvider({ oauthClient, driveId: config.driveId || null });
};

const getStorageAdapter = async (firm) => {
  const firmId = typeof firm === 'string' ? firm : firm?._id?.toString?.() || firm?.id || firm?.firmId;
  if (!firmId) {
    throw new StorageConfigMissingError('unknown');
  }

  const firmDoc = await Firm.findById(firmId).select('storageConfig').lean();
  if (!firmDoc?.storageConfig?.provider || firmDoc.storageConfig.provider === 'docketra_managed') {
    return new DocketraGoogleAdapter();
  }
  const provider = String(firmDoc.storageConfig.provider).toLowerCase();
  const credentials = firmDoc.storageConfig.credentials
    ? JSON.parse(decrypt(firmDoc.storageConfig.credentials))
    : {};
  if (provider === 'google_drive' || provider === 'google-drive') {
    return buildGoogleDriveAdapter({
      credentials: {
        googleRefreshToken: credentials.refreshToken || credentials.googleRefreshToken,
      },
      driveId: credentials.driveId || null,
    });
  }
  if (provider === 's3') {
    return new S3Adapter(credentials || {});
  }

  throw new UnsupportedProviderError(provider, firmId);
};

module.exports = {
  DocketraGoogleAdapter,
  S3Adapter,
  getStorageAdapter,
};
