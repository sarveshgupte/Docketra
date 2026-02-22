/**
 * StorageProvider Interface
 *
 * Base class defining the contract for all BYOS storage providers.
 * Concrete providers (GoogleDriveProvider, OneDriveProvider, etc.)
 * must extend this class and implement every method.
 *
 * All methods throw NotImplementedError by default so that
 * missing implementations are surfaced at call-time.
 */

class NotImplementedError extends Error {
  constructor(methodName) {
    super(`StorageProvider.${methodName}() is not implemented`);
    this.name = 'NotImplementedError';
  }
}

class StorageProvider {
  /**
   * Create the root folder for a firm in the storage backend.
   * @param {string} firmId
   * @returns {Promise<{folderId: string}>}
   */
  async createRootFolder(firmId) { // eslint-disable-line no-unused-vars
    throw new NotImplementedError('createRootFolder');
  }

  /**
   * Create a case-specific subfolder under the firm root.
   * @param {string} firmId
   * @param {string} caseId
   * @returns {Promise<{folderId: string}>}
   */
  async createCaseFolder(firmId, caseId) { // eslint-disable-line no-unused-vars
    throw new NotImplementedError('createCaseFolder');
  }

  /**
   * Upload a file to the given folder.
   * @param {string} firmId
   * @param {string} folderId
   * @param {Buffer} fileBuffer
   * @param {object} metadata  e.g. { name, mimeType }
   * @returns {Promise<{fileId: string}>}
   */
  async uploadFile(firmId, folderId, fileBuffer, metadata) { // eslint-disable-line no-unused-vars
    throw new NotImplementedError('uploadFile');
  }

  /**
   * Delete a file from the storage backend.
   * @param {string} firmId
   * @param {string} fileId
   * @returns {Promise<void>}
   */
  async deleteFile(firmId, fileId) { // eslint-disable-line no-unused-vars
    throw new NotImplementedError('deleteFile');
  }

  /**
   * Retrieve metadata for a stored file.
   * @param {string} firmId
   * @param {string} fileId
   * @returns {Promise<object>}
   */
  async getFileMetadata(firmId, fileId) { // eslint-disable-line no-unused-vars
    throw new NotImplementedError('getFileMetadata');
  }

  /**
   * Verify that the provider credentials are still valid.
   * @param {string} firmId
   * @returns {Promise<{healthy: boolean}>}
   */
  async healthCheck(firmId) { // eslint-disable-line no-unused-vars
    throw new NotImplementedError('healthCheck');
  }
}

module.exports = { StorageProvider, NotImplementedError };
