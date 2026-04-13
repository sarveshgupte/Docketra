const { google } = require('googleapis');
const Firm = require('../../models/Firm.model');
const { decrypt } = require('./services/TokenEncryption.service');
const GoogleDriveProvider = require('./providers/GoogleDriveProvider');
const OneDriveProvider = require('./providers/OneDriveProvider');
const { S3Provider } = require('./providers/S3Provider');
const { googleDriveService } = require('../googleDrive.service');
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
  const firm = await Firm.findById(firmId).select('storageConfig').lean();
  if (!firm) {
    throw new StorageConfigMissingError(firmId);
  }

  if (!firm.storageConfig) {
    console.error('[STORAGE] Missing storageConfig for firm', firmId);
  }

  if (!firm.storageConfig?.provider) {
    throw new StorageConfigMissingError(firmId);
  }

  return {
    provider: firm.storageConfig.provider,
    credentials: decryptCredentials(firm.storageConfig.credentials, firmId),
    source: 'firm.storageConfig',
  };
}

async function getProviderForTenant(firmId) {
  if (!firmId) {
    throw new StorageConfigMissingError('unknown');
  }

  let config = null;
  try {
    config = await getFirmStorageConfig(firmId);
  } catch (error) {
    if (!(error instanceof StorageConfigMissingError)) throw error;
    config = { provider: 'docketra_drive', credentials: {}, source: 'managed_default' };
  }
  const provider = String(config.provider || '').toLowerCase();
  if (!provider) {
    throw new Error(`Invalid storage provider for firm ${firmId}`);
  }
  console.info('[STORAGE]', {
    event: 'provider_resolution',
    firmId: String(firmId),
    provider,
    source: config.source,
  });

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
    case 'docketra_drive':
    case 'docketra_managed': {
      const managed = await googleDriveService.getClient(firmId);
      return new GoogleDriveProvider({
        driveClient: managed.drive,
        driveId: null,
      });
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
