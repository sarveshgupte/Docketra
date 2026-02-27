const TenantStorageConfig = require('../models/TenantStorageConfig.model');
const { decrypt } = require('./services/TokenEncryption.service');
const { S3Provider } = require('./providers/S3Provider');
const {
  StorageConfigMissingError,
  StorageAccessError,
  UnsupportedProviderError,
} = require('./errors');

function parseCredentials(encryptedCredentials, tenantId) {
  try {
    const decrypted = decrypt(encryptedCredentials);
    const credentials = JSON.parse(decrypted);
    if (!credentials?.accessKeyId || !credentials?.secretAccessKey) {
      throw new Error('Credential fields missing');
    }
    return credentials;
  } catch (error) {
    throw new StorageAccessError('Failed to decrypt storage credentials', tenantId, error);
  }
}

async function getProviderForTenant(tenantId) {
  const config = await TenantStorageConfig.findOne({ tenantId, isActive: true });
  if (!config) {
    throw new StorageConfigMissingError(tenantId);
  }

  const credentials = parseCredentials(config.encryptedCredentials, tenantId);

  switch (config.provider) {
    case 'aws_s3':
      return new S3Provider({
        tenantId,
        bucket: config.bucket,
        region: config.region,
        prefix: config.prefix,
        credentials,
      });
    case 'azure_blob':
    case 'gcs':
      throw new UnsupportedProviderError(config.provider, tenantId);
    default:
      throw new UnsupportedProviderError(config.provider, tenantId);
  }
}

module.exports = {
  getProviderForTenant,
};
