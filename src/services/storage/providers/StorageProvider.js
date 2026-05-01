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
}

module.exports = StorageProvider;
