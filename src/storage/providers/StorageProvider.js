class StorageProvider {
  async generateUploadUrl(objectKey, expiresIn) { // eslint-disable-line no-unused-vars
    throw new Error('StorageProvider.generateUploadUrl() not implemented');
  }

  async generateDownloadUrl(objectKey, expiresIn) { // eslint-disable-line no-unused-vars
    throw new Error('StorageProvider.generateDownloadUrl() not implemented');
  }

  async deleteObject(objectKey) { // eslint-disable-line no-unused-vars
    throw new Error('StorageProvider.deleteObject() not implemented');
  }

  async testConnection() {
    throw new Error('StorageProvider.testConnection() not implemented');
  }
}

module.exports = StorageProvider;
