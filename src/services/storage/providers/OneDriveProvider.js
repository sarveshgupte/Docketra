/**
 * OneDrive Provider (stub)
 * Placeholder for future OneDrive OAuth-based implementation.
 */
class OneDriveProvider {
  constructor(storageConfig = {}) {
    this.name = 'onedrive';
    this.config = storageConfig;
  }

  async uploadFile() {
    throw new Error('OneDriveProvider.uploadFile not implemented');
  }

  async downloadFile() {
    throw new Error('OneDriveProvider.downloadFile not implemented');
  }

  async deleteFile() {
    throw new Error('OneDriveProvider.deleteFile not implemented');
  }

  async createFolder() {
    throw new Error('OneDriveProvider.createFolder not implemented');
  }
}

module.exports = OneDriveProvider;
