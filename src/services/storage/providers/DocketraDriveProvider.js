const driveService = require('../../drive.service');

/**
 * Docketra-managed Google Drive provider (service account based)
 * Wraps the existing drive.service with the storage provider interface.
 */
class DocketraDriveProvider {
  constructor() {
    this.name = 'docketra_managed_google_drive';
  }

  async uploadFile(buffer, fileName, mimeType, parentRef) {
    return driveService.uploadFile(buffer, fileName, mimeType, parentRef);
  }

  async downloadFile(fileId) {
    return driveService.downloadFile(fileId);
  }

  async deleteFile(fileId) {
    return driveService.deleteFile(fileId);
  }

  async createFolder(name, parentRef) {
    return driveService.createFolder(name, parentRef);
  }

  async getOrCreateFolder(name, parentRef) {
    if (typeof driveService.getOrCreateFolder === 'function') {
      return driveService.getOrCreateFolder(name, parentRef);
    }
    return this.createFolder(name, parentRef);
  }
}

module.exports = DocketraDriveProvider;
