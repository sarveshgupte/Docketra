const { UnsupportedProviderFeatureError } = require('../errors');

class StorageProvider {
  constructor() {
    this.providerName = 'unknown';
  }

  async generateUploadUrl(objectKey, expiresIn) { // eslint-disable-line no-unused-vars
    throw new UnsupportedProviderFeatureError(this.providerName, 'generateUploadUrl');
  }

  async generateDownloadUrl(objectKey, expiresIn) { // eslint-disable-line no-unused-vars
    throw new UnsupportedProviderFeatureError(this.providerName, 'generateDownloadUrl');
  }

  async deleteObject(objectKey) { // eslint-disable-line no-unused-vars
    throw new UnsupportedProviderFeatureError(this.providerName, 'deleteObject');
  }

  async testConnection() {
    throw new UnsupportedProviderFeatureError(this.providerName, 'testConnection');
  }

  async getFileMetadata(fileId) { // eslint-disable-line no-unused-vars
    throw new UnsupportedProviderFeatureError(this.providerName, 'getFileMetadata');
  }

  async createDirectUploadSession(options) { // eslint-disable-line no-unused-vars
    throw new UnsupportedProviderFeatureError(this.providerName, 'createDirectUploadSession');
  }

  async verifyUploadedObject(options) { // eslint-disable-line no-unused-vars
    throw new UnsupportedProviderFeatureError(this.providerName, 'verifyUploadedObject');
  }

  async uploadFile(parentOrPath, fileName, streamOrBuffer, mimeType) { // eslint-disable-line no-unused-vars
    throw new UnsupportedProviderFeatureError(this.providerName, 'uploadFile');
  }

  async downloadFile(fileIdOrObjectKey) { // eslint-disable-line no-unused-vars
    throw new UnsupportedProviderFeatureError(this.providerName, 'downloadFile');
  }

  async listFiles(parentOrPath) { // eslint-disable-line no-unused-vars
    throw new UnsupportedProviderFeatureError(this.providerName, 'listFiles');
  }

  async getOrCreateFolder(parentId, name) { // eslint-disable-line no-unused-vars
    throw new UnsupportedProviderFeatureError(this.providerName, 'getOrCreateFolder');
  }

  static formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) return null;
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / (1024 ** exponent);
    const precision = value >= 10 || exponent === 0 ? 0 : 1;
    return `${value.toFixed(precision)} ${units[exponent]}`;
  }
}

module.exports = StorageProvider;
