class BaseStorageProvider {
  async uploadFile() {
    throw new Error('uploadFile() must be implemented by provider adapter');
  }

  async getFile() {
    throw new Error('getFile() must be implemented by provider adapter');
  }
}

module.exports = BaseStorageProvider;
