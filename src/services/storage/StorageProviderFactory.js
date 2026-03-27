const { getStorageAdapter } = require('../storageAdapter.service');

class StorageProviderFactory {
  static async getProvider(firmId) {
    if (!firmId) throw new Error('Firm context is required to resolve storage provider');
    return getStorageAdapter(firmId);
  }
}

module.exports = { StorageProviderFactory };
