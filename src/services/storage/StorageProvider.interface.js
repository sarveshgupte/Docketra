class StorageProvider {
  constructor() {
    this.providerName = 'unknown';
  }

  /**
   * IMPORTANT SECURITY ASSUMPTION:
   * Callers must resolve provider instances with a server-side firmId from auth context.
   * Providers must never trust client-supplied firm identifiers for tenant isolation.
   */

  async authenticate() { throw new Error('StorageProvider.authenticate not implemented'); }
  async createFolder() { throw new Error('StorageProvider.createFolder not implemented'); }
  async uploadFile() { throw new Error('StorageProvider.uploadFile not implemented'); }
  async downloadFile() { throw new Error('StorageProvider.downloadFile not implemented'); }
  async deleteFile() { throw new Error('StorageProvider.deleteFile not implemented'); }
  async listFiles() { throw new Error('StorageProvider.listFiles not implemented'); }
  async shareFile() { throw new Error('StorageProvider.shareFile not implemented'); }
  async getFolderPath() { throw new Error('StorageProvider.getFolderPath not implemented'); }

  // Legacy compatibility for existing services expecting getOrCreateFolder
  async getOrCreateFolder(parentFolderId, folderName) {
    const created = await this.createFolder(parentFolderId, folderName);
    return created.folderId || created.id || created;
  }
}

module.exports = StorageProvider;
