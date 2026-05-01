const { google } = require('googleapis');
const Firm = require('../../models/Firm.model');
const GoogleDriveProvider = require('./providers/GoogleDriveProvider');
const OneDriveProvider = require('./providers/OneDriveProvider');
const { S3Provider } = require('./providers/S3Provider');
const DocketraManagedStorageProvider = require('./providers/DocketraManagedStorageProvider');
const log = require('../../utils/log');
const {
  StorageConfigMissingError,
  StorageAccessError,
  UnsupportedProviderError,
} = require('./errors');
const { resolveFirmStorageState } = require('./resolveFirmStorageState');

async function getFirmStorageConfig(firmId) {
  const firm = await Firm.findById(firmId).select('storageConfig storage').lean();
  if (!firm) throw new StorageConfigMissingError(firmId);

  const state = resolveFirmStorageState(firm, { includeCredentials: true });
  if (state.mode === 'firm_connected' && !state.canonicalProvider) {
    throw new StorageAccessError('Firm is marked firm_connected but no usable provider is configured', firmId);
  }
  if (!state.canonicalProvider) throw new StorageConfigMissingError(firmId);

  if (!firm.storageConfig && state.canonicalProvider !== 'docketra_managed') {
    log.error('[STORAGE] Missing storageConfig for firm', firmId);
  }

  return {
    provider: state.canonicalProvider,
    credentials: state.credentials || {},
    source: state.source,
    connectionStatus: state.connectionStatus,
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
    throw new StorageAccessError('Cloud storage must be connected', firmId, error);
  }
  const provider = String(config.provider || '').toLowerCase();
  if (!provider) {
    throw new Error(`Invalid storage provider for firm ${firmId}`);
  }
  log.info('[STORAGE]', {
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
    case 'docketra_managed':
      return new DocketraManagedStorageProvider({ firmId });
    case 'onedrive':
      return new OneDriveProvider({
        refreshToken: config.credentials.refreshToken,
        driveId: config.credentials.driveId || null,
      });
    case 's3':
      return new S3Provider({ tenantId: String(firmId), ...config.credentials });
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
