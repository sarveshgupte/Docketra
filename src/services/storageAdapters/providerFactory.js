const FirmStorageConfig = require('../../models/FirmStorageConfig.model');
const GoogleDriveStorageProvider = require('./providers/GoogleDriveStorageProvider');

async function resolveFirmStorage(firmId) {
  const config = await FirmStorageConfig.findOne({ firmId, isActive: true }).lean();
  if (!config) {
    const error = new Error('Storage configuration not found for firm');
    error.code = 'STORAGE_CONFIG_NOT_FOUND';
    error.status = 404;
    throw error;
  }

  if (config.status !== 'ACTIVE') {
    const error = new Error(`Storage is not active for firm (status: ${config.status})`);
    error.code = 'STORAGE_NOT_ACTIVE';
    error.status = 409;
    throw error;
  }

  return config;
}

function getProviderAdapter(storageConfig) {
  switch (storageConfig.provider) {
    case 'google_drive':
      return new GoogleDriveStorageProvider(storageConfig);
    default: {
      const error = new Error(`Unsupported storage provider: ${storageConfig.provider}`);
      error.code = 'UNSUPPORTED_STORAGE_PROVIDER';
      error.status = 400;
      throw error;
    }
  }
}

module.exports = {
  resolveFirmStorage,
  getProviderAdapter,
};
