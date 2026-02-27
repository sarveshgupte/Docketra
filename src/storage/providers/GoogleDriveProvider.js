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
const { Readable } = require('stream');
const { StorageProvider } = require('../StorageProvider.interface');

class GoogleDriveProvider extends StorageProvider {
  /**
   * @param {object|null} oauthClient  - An authenticated google.auth.OAuth2 instance.
   *                                     Optional; only required for methods that call
   *                                     the Drive API on behalf of the firm owner.
   */
  constructor({ oauthClient = null, driveId = null } = {}) {
    super();
    if (!oauthClient) {
      throw new Error('[GoogleDriveProvider] oauthClient is required');
    }
    this.providerName = 'google_drive';
    this.oauthClient = oauthClient;
    this.driveId = driveId;
  }

  getClient() {
    if (!this.oauthClient) {
      throw new Error('[GoogleDriveProvider] oauthClient is required');
    }
    return google.drive({ version: 'v3', auth: this.oauthClient });
  }

  async testConnection() {
    const drive = this.getClient();
    await drive.about.get({ fields: 'user' });
    return { healthy: true };
  }

  async createFolder(name, parentId) {
    const drive = this.getClient();
    const requestBody = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentId ? { parents: [parentId] } : {}),
    };
    if (this.driveId) {
      requestBody.driveId = this.driveId;
    }
    const res = await drive.files.create({
      requestBody,
      supportsAllDrives: true,
      fields: 'id',
    });
    return { folderId: res.data.id };
  }

  async uploadFileStream({ folderId, filename, mimeType, stream }) {
    const drive = this.getClient();
    const res = await drive.files.create({
      requestBody: {
        name: filename,
        parents: [folderId],
      },
      media: {
        mimeType,
        body: stream,
      },
      supportsAllDrives: true,
      fields: 'id',
    });
    return { fileId: res.data.id };
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
    const { folderId } = await this.createFolder('Docketra');
    console.info(`[Storage][GoogleDrive] Root folder created for firm: ${firmId}, folderId: ${folderId}`);
    return { folderId };
  }

  /**
   * Create (or retrieve existing) case folder inside the firm's root Drive folder.
   *
   * Idempotent: if the folder already exists it is returned without creating a duplicate.
   *
   * @param {string} firmId
   * @param {string} caseId
   * @param {string} rootFolderId - Google Drive folder ID of the firm's /Docketra root.
   * @returns {Promise<{folderId: string}>}
   */
  async createCaseFolder(firmId, caseId, rootFolderId) {
    const drive = this.getClient();

    // Escape single quotes for the Drive query language (apostrophe → \')
    const safeCaseId = caseId.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const safeRootFolderId = rootFolderId.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

    // Check whether the folder already exists (idempotency)
    const listRes = await drive.files.list({
      q: `name = '${safeCaseId}' and '${safeRootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'files(id)',
      spaces: 'drive',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    if (listRes.data.files && listRes.data.files.length > 0) {
      const folderId = listRes.data.files[0].id;
      console.info(`[Storage][GoogleDrive] Case folder ready`, { firmId, caseId });
      return { folderId };
    }

    // Folder does not exist — create it
    const { folderId } = await this.createFolder(caseId, rootFolderId);
    console.info(`[Storage][GoogleDrive] Case folder ready`, { firmId, caseId });
    return { folderId };
  }

  /**
   * Upload a file to a Google Drive folder.
   *
   * @param {string} firmId
   * @param {string} folderId - Google Drive folder ID to upload into
   * @param {Buffer} fileBuffer - File content
   * @param {{ name: string, mimeType: string }} metadata
   * @returns {Promise<{ fileId: string }>}
   */
  async uploadFile(firmId, folderId, fileBuffer, metadata) {
    const bodyStream = Readable.from(fileBuffer);
    const { fileId } = await this.uploadFileStream({
      folderId,
      filename: metadata.name,
      mimeType: metadata.mimeType,
      stream: bodyStream,
    });
    // fileId intentionally not logged (security: no storage IDs in logs)
    console.info(`[Storage][GoogleDrive] File uploaded`, { firmId, folderId });
    return { fileId };
  }

  async deleteFile(firmId, fileId) {
    const drive = this.getClient();
    await drive.files.delete({ fileId, supportsAllDrives: true });
    console.info(`[Storage][GoogleDrive] deleteFile called for firm: ${firmId}`);
  }

  async getFileMetadata(firmId, fileId) {
    const drive = this.getClient();
    const res = await drive.files.get({
      fileId,
      fields: 'id,name,mimeType,size,modifiedTime,trashed',
      supportsAllDrives: true,
    });
    console.info(`[Storage][GoogleDrive] getFileMetadata called for firm: ${firmId}`);
    return res.data || {};
  }

  async healthCheck(firmId) {
    const healthy = await this.testConnection();
    console.info(`[Storage][GoogleDrive] healthCheck called for firm: ${firmId}`);
    return healthy;
  }
}

module.exports = GoogleDriveProvider;
