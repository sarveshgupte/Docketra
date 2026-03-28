const { google } = require('googleapis');
const StorageConfiguration = require('../models/StorageConfiguration.model');
const { decrypt } = require('../services/storage/services/TokenEncryption.service');
const GoogleDriveProvider = require('./storage/providers/GoogleDriveProvider');

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
      throw new Error('S3 credentials are incomplete');
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
      throw new Error('Unable to decrypt Google Drive credentials');
    }
  }
  if (!refreshToken) {
    throw new Error('Missing Google Drive refresh token');
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
    throw new Error('Firm context is required');
  }

  const config = await StorageConfiguration.findOne({ firmId: String(firmId), isActive: true }).lean();
  if (!config || config.provider === 'docketra_managed') {
    return new DocketraGoogleAdapter();
  }
  if (config.provider === 'google-drive') {
    return buildGoogleDriveAdapter(config);
  }
  if (config.provider === 's3') {
    return new S3Adapter(config.credentials || {});
  }

  throw new Error(`Unsupported storage provider: ${config.provider}`);
};

module.exports = {
  DocketraGoogleAdapter,
  S3Adapter,
  getStorageAdapter,
};
