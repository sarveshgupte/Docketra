/**
 * GoogleDriveProvider
 *
 * BYOS Google Drive storage provider.
 * Accepts an authenticated OAuth2 client at construction time so that
 * OAuth-specific operations (e.g. root folder creation during connect flow)
 * can use the firm's own credentials.
 *
 * DO NOT log tokens or sensitive credential data in this file.
 */

const { google } = require('googleapis');
const { StorageProvider } = require('../StorageProvider.interface');

class GoogleDriveProvider extends StorageProvider {
  /**
   * @param {object|null} oauthClient  - An authenticated google.auth.OAuth2 instance.
   *                                     Optional; only required for methods that call
   *                                     the Drive API on behalf of the firm owner.
   */
  constructor(oauthClient = null) {
    super();
    this.providerName = 'google';
    this.oauthClient = oauthClient;
  }

  /**
   * Create the /Docketra root folder in the firm's Google Drive.
   *
   * Requires an authenticated OAuth2 client (passed via constructor).
   *
   * @param {string} firmId
   * @returns {Promise<{folderId: string}>}
   */
  async createRootFolder(firmId) {
    if (!this.oauthClient) {
      throw new Error(
        '[GoogleDriveProvider] oauthClient is required for createRootFolder. ' +
        'Pass an authenticated OAuth2 client to the constructor.'
      );
    }
    const drive = google.drive({ version: 'v3', auth: this.oauthClient });
    const res = await drive.files.create({
      requestBody: {
        name: 'Docketra',
        mimeType: 'application/vnd.google-apps.folder',
      },
      fields: 'id',
    });
    const folderId = res.data.id;
    console.info(`[Storage][GoogleDrive] Root folder created for firm: ${firmId}, folderId: ${folderId}`);
    return { folderId };
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
