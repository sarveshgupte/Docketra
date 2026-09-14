const { google } = require('googleapis');
const GoogleDriveProvider = require('./GoogleDriveProvider');
const { S3Provider } = require('./S3Provider');
const { StorageAccessError } = require('../errors');

function managedConfigError(firmId) {
  const error = new StorageAccessError('Managed storage backend is not configured', String(firmId || 'unknown'));
  error.code = 'MANAGED_STORAGE_NOT_CONFIGURED';
  error.statusCode = 503;
  return error;
}

class DocketraManagedStorageProvider extends GoogleDriveProvider {
  constructor({ firmId }) {
    const normalizedFirmId = String(firmId || '').trim();
    if (!normalizedFirmId) {
      throw managedConfigError('unknown');
    }

    const provider = String(process.env.MANAGED_STORAGE_PROVIDER || '').trim().toLowerCase();
    const s3Bucket = String(process.env.MANAGED_STORAGE_S3_BUCKET || '').trim();
    const s3Region = String(process.env.MANAGED_STORAGE_S3_REGION || '').trim();

    if (provider === 'google_drive' || (!s3Bucket && process.env.DRIVE_ROOT_FOLDER_ID)) {
      const rootFolderId = String(process.env.DRIVE_ROOT_FOLDER_ID || '').trim();
      const clientEmail = String(process.env.MANAGED_GOOGLE_CLIENT_EMAIL || '').trim();
      const privateKey = String(process.env.MANAGED_GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();

      if (!rootFolderId || !clientEmail || !privateKey) {
        throw managedConfigError(normalizedFirmId);
      }

      const auth = new google.auth.JWT({
        email: clientEmail,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/drive'],
      });

      super({ oauthClient: auth });
      this.providerName = 'docketra_managed';
      this.rootFolderId = rootFolderId;
      this.firmId = normalizedFirmId;
      this.backendType = 'google_drive';
      return;
    }

    if (s3Bucket && s3Region) {
      super({ oauthClient: null });
      this.providerName = 'docketra_managed';
      this.firmId = normalizedFirmId;
      this.backendType = 's3';

      const credentials = process.env.MANAGED_STORAGE_S3_ACCESS_KEY_ID && process.env.MANAGED_STORAGE_S3_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.MANAGED_STORAGE_S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.MANAGED_STORAGE_S3_SECRET_ACCESS_KEY,
            ...(process.env.MANAGED_STORAGE_S3_SESSION_TOKEN ? { sessionToken: process.env.MANAGED_STORAGE_S3_SESSION_TOKEN } : {}),
          }
        : undefined;

      const prefixBase = (process.env.MANAGED_STORAGE_S3_PREFIX || 'docketra-managed').trim().replace(/^\/+|\/+$/g, '') || 'docketra-managed';
      const tenantPrefix = `${prefixBase}/firms/${normalizedFirmId}`;

      this.s3Provider = new S3Provider({ tenantId: normalizedFirmId, bucket: s3Bucket, region: s3Region, prefix: tenantPrefix, credentials });
      return;
    }

    throw managedConfigError(normalizedFirmId);
  }

  async getOrCreateFolder(parentFolderId = null, folderName) {
    if (this.backendType === 's3') {
      return this.s3Provider.getOrCreateFolder(parentFolderId, folderName);
    }
    const resolvedParentFolderId = parentFolderId || this.rootFolderId;
    return super.getOrCreateFolder(resolvedParentFolderId, folderName);
  }

  async uploadFile(...args) {
    if (this.backendType === 's3') return this.s3Provider.uploadFile(...args);
    return super.uploadFile(...args);
  }

  async downloadFile(...args) {
    if (this.backendType === 's3') return this.s3Provider.downloadFile(...args);
    return super.downloadFile(...args);
  }

  async deleteFile(...args) {
    if (this.backendType === 's3') return this.s3Provider.deleteFile(...args);
    return super.deleteFile(...args);
  }

  async testConnection(...args) {
    if (this.backendType === 's3') return this.s3Provider.testConnection(...args);
    return super.testConnection(...args);
  }

  async generateUploadUrl(...args) {
    if (this.backendType === 's3') return this.s3Provider.generateUploadUrl(...args);
    if (typeof super.generateUploadUrl === 'function') return super.generateUploadUrl(...args);
    return null;
  }

  async generateDownloadUrl(...args) {
    if (this.backendType === 's3') return this.s3Provider.generateDownloadUrl(...args);
    if (typeof super.generateDownloadUrl === 'function') return super.generateDownloadUrl(...args);
    return null;
  }
}

module.exports = DocketraManagedStorageProvider;
