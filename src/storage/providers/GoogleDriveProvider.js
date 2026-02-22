/**
 * GoogleDriveProvider — Placeholder
 *
 * Scaffolding for BYOS Google Drive integration.
 * Real OAuth and Drive API calls will be added in a future PR.
 *
 * DO NOT log tokens or sensitive credential data in this file.
 */

const { StorageProvider } = require('../StorageProvider.interface');

class GoogleDriveProvider extends StorageProvider {
  constructor() {
    super();
    this.providerName = 'google';
  }

  async createRootFolder(firmId) {
    console.info(`[Storage][GoogleDrive] createRootFolder called for firm: ${firmId}`);
    return { folderId: null };
  }

  async createCaseFolder(firmId, caseId) {
    console.info(`[Storage][GoogleDrive] createCaseFolder called for firm: ${firmId}, case: ${caseId}`);
    return { folderId: null };
  }

  async uploadFile(firmId, folderId, fileBuffer, metadata) {
    console.info(`[Storage][GoogleDrive] uploadFile called for firm: ${firmId}, folder: ${folderId}, file: ${metadata && metadata.name}`);
    return { fileId: null };
  }

  async deleteFile(firmId, fileId) {
    console.info(`[Storage][GoogleDrive] deleteFile called for firm: ${firmId}, file: ${fileId}`);
  }

  async getFileMetadata(firmId, fileId) {
    console.info(`[Storage][GoogleDrive] getFileMetadata called for firm: ${firmId}, file: ${fileId}`);
    return {};
  }

  async healthCheck(firmId) {
    console.info(`[Storage][GoogleDrive] healthCheck called for firm: ${firmId}`);
    return { healthy: true };
  }
}

module.exports = GoogleDriveProvider;
