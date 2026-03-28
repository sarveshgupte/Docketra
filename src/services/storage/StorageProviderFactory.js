const { google } = require('googleapis');
const Firm = require('../../models/Firm.model');
const StorageConfiguration = require('../../models/StorageConfiguration.model');
const { decrypt } = require('./services/TokenEncryption.service');
const GoogleDriveProvider = require('./providers/GoogleDriveProvider');
const OneDriveProvider = require('./providers/OneDriveProvider');
const { S3Provider } = require('./providers/S3Provider');
const {
  StorageConfigMissingError,
  StorageAccessError,
  UnsupportedProviderError,
} = require('./errors');

function decryptCredentials(encryptedBlob, firmId) {
  if (!encryptedBlob) return {};
  try {
    return JSON.parse(decrypt(encryptedBlob));
  } catch (error) {
    throw new StorageAccessError('Failed to decrypt firm storage credentials', firmId, error);
  }
}

async function getFirmStorageConfig(firmId) {
  const firm = await Firm.findById(firmId).select('storageConfig storage mode provider').lean();
  if (!firm) {
    throw new StorageConfigMissingError(firmId);
  }

  if (firm.storageConfig?.provider) {
    return {
      provider: firm.storageConfig.provider,
      credentials: decryptCredentials(firm.storageConfig.credentials, firmId),
      source: 'firm.storageConfig',
    };
  }

  const legacy = await StorageConfiguration.findOne({ firmId: String(firmId), isActive: true }).lean();
  if (!legacy) {
    throw new StorageConfigMissingError(firmId);
  }

  const provider = legacy.provider === 'google-drive' ? 'google_drive' : legacy.provider;
  const credentials = legacy.credentials?.encryptedPayload
    ? decryptCredentials(legacy.credentials.encryptedPayload, firmId)
    : legacy.credentials || {};

  if (provider === 'google_drive' && legacy.credentials?.googleRefreshToken) {
    credentials.refreshToken = decrypt(legacy.credentials.googleRefreshToken);
    credentials.connectedEmail = legacy.credentials.connectedEmail || null;
    credentials.driveId = legacy.driveId || credentials.driveId || null;
  }

  return { provider, credentials, source: 'StorageConfiguration' };
}

async function getProviderForTenant(firmId) {
  if (!firmId) {
    throw new StorageConfigMissingError('unknown');
  }

  const config = await getFirmStorageConfig(firmId);
  const provider = String(config.provider || '').toLowerCase();

  switch (provider) {
    case 'google_drive': {
      const refreshToken = config.credentials.refreshToken || config.credentials.googleRefreshToken;
      if (!refreshToken) {
        throw new StorageAccessError('Missing Google Drive refresh token', firmId);
      }
      const oauthClient = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_OAUTH_REDIRECT_URI
      );
      oauthClient.setCredentials({ refresh_token: refreshToken });
      return new GoogleDriveProvider({ oauthClient, driveId: config.credentials.driveId || null });
    }
    case 'onedrive':
      return new OneDriveProvider({
        refreshToken: config.credentials.refreshToken,
        driveId: config.credentials.driveId || null,
      });
    case 's3':
      return new S3Provider(config.credentials);
    default:
      throw new UnsupportedProviderError(provider || 'unknown', firmId);
  }
}

class StorageProviderFactory {
  static async getProvider(firmId) {
    return getProviderForTenant(firmId);
  }
}

module.exports = {
  StorageProviderFactory,
  getProviderForTenant,
};
