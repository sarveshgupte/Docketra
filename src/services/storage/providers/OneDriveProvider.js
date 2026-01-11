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
    throw new Error('OneDriveProvider.uploadFile not implemented in this release');
  }

  async downloadFile() {
    throw new Error('OneDriveProvider.downloadFile not implemented in this release');
  }

  async deleteFile() {
    throw new Error('OneDriveProvider.deleteFile not implemented in this release');
  }

  async createFolder() {
    throw new Error('OneDriveProvider.createFolder not implemented in this release');
  }

  async getOrCreateFolder() {
    throw new Error('OneDriveProvider.getOrCreateFolder not implemented in this release');
  }
}

module.exports = OneDriveProvider;
