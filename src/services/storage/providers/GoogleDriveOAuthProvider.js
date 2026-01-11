/**
 * Google Drive OAuth Provider (stub)
 * Accepts firm-level storage configuration and exposes the storage provider interface.
 * Actual OAuth token handling is out of scope for this PR.
 */
class GoogleDriveOAuthProvider {
  constructor(storageConfig = {}) {
    this.name = 'google_drive_oauth';
    this.config = storageConfig;
  }

  async uploadFile() {
    throw new Error('GoogleDriveOAuthProvider.uploadFile not implemented');
  }

  async downloadFile() {
    throw new Error('GoogleDriveOAuthProvider.downloadFile not implemented');
  }

  async deleteFile() {
    throw new Error('GoogleDriveOAuthProvider.deleteFile not implemented');
  }

  async createFolder() {
    throw new Error('GoogleDriveOAuthProvider.createFolder not implemented');
  }
}

module.exports = GoogleDriveOAuthProvider;
