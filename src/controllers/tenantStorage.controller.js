const TenantStorageConfig = require('../models/TenantStorageConfig.model');
const { encrypt } = require('../storage/services/TokenEncryption.service');
const { S3Provider } = require('../storage/providers/S3Provider');
const { UnsupportedProviderError } = require('../storage/errors');

function maskCredentialLog(tenantId, provider) {
  return { tenantId, provider };
}

function buildProviderForValidation({ tenantId, provider, bucket, region, prefix, credentials }) {
  switch (provider) {
    case 'aws_s3':
      return new S3Provider({ tenantId, bucket, region, prefix, credentials });
    case 'azure_blob':
    case 'gcs':
      throw new UnsupportedProviderError(provider, tenantId);
    default:
      throw new UnsupportedProviderError(provider, tenantId);
  }
}

async function updateTenantStorage(req, res) {
  const tenantId = req.firmId;

  try {
    const {
      provider,
      bucket,
      region,
      prefix = '',
      accessKeyId,
      secretAccessKey,
    } = req.body;

    const credentials = { accessKeyId, secretAccessKey };
    const providerInstance = buildProviderForValidation({
      tenantId,
      provider,
      bucket,
      region,
      prefix,
      credentials,
    });

    await providerInstance.testConnection();

    const encryptedCredentials = encrypt(JSON.stringify(credentials));

    await TenantStorageConfig.updateMany({ tenantId, isActive: true }, { isActive: false });

    const config = await TenantStorageConfig.findOneAndUpdate(
      { tenantId, provider },
      {
        tenantId,
        provider,
        encryptedCredentials,
        bucket,
        region,
        prefix,
        isActive: true,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.info('[TenantStorage] Updated storage config', maskCredentialLog(tenantId, provider));

    return res.json({
      success: true,
      data: {
        id: config._id,
        tenantId,
        provider,
        bucket,
        region,
        prefix,
        isActive: true,
      },
    });
  } catch (error) {
    console.error('[TenantStorage] Failed to update storage config', {
      tenantId,
      message: error.message,
    });

    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
      code: error.code || 'STORAGE_UPDATE_FAILED',
    });
  }
}

module.exports = {
  updateTenantStorage,
};
