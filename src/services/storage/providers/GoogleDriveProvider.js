const { google } = require('googleapis');
const { Readable } = require('stream');
const StorageProvider = require('./StorageProvider');
const { StorageAccessError } = require('../errors');

class GoogleDriveProvider extends StorageProvider {
  constructor({ oauthClient, driveId, driveClient } = {}) {
    super();
    this.providerName = 'google-drive';
    this.oauthClient = oauthClient;
    this.driveId = driveId || null;
    this.driveClient = driveClient || null;
  }

  async authenticate(credentials = {}) {
    const refreshToken = credentials.refreshToken;
    if (!this.oauthClient && !refreshToken) {
      throw new StorageAccessError('Google Drive credentials are missing', 'unknown');
    }
    if (!this.oauthClient) {
      const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI } = process.env;
      this.oauthClient = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI);
      this.oauthClient.setCredentials({ refresh_token: refreshToken });
    }
    return this.oauthClient;
  }

  getClient() {
    if (this.driveClient) {
      return this.driveClient;
    }
    if (!this.oauthClient) {
      throw new StorageAccessError('Google Drive OAuth client is not initialized', 'unknown');
    }
    return google.drive({ version: 'v3', auth: this.oauthClient });
  }

  async testConnection(rootFolderId = null) {
    const drive = this.getClient();
    if (this.driveId) {
      await drive.drives.get({ driveId: this.driveId, fields: 'id' });
    }
    if (rootFolderId) {
      await drive.files.get({ fileId: rootFolderId, fields: 'id', supportsAllDrives: true });
    }
    return { healthy: true };
  }

  async createFolder(parentFolderId, folderName) {
    const drive = this.getClient();
    const requestBody = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentFolderId ? { parents: [parentFolderId] } : {}),
    };
    const created = await drive.files.create({
      requestBody,
      supportsAllDrives: true,
      fields: 'id',
    });
    return { folderId: created.data.id };
  }

  async uploadFile(folderId, filename, stream, mimeType = 'application/octet-stream') {
    const drive = this.getClient();
    const created = await drive.files.create({
      requestBody: { name: filename, parents: [folderId] },
      media: { mimeType, body: stream },
      supportsAllDrives: true,
      fields: 'id,webViewLink',
    });
    return {
      fileId: created.data.id,
      webViewLink: created.data.webViewLink || null,
    };
  }

  async uploadFileBuffer(folderId, filename, fileBuffer, mimeType) {
    return this.uploadFile(folderId, filename, Readable.from(fileBuffer), mimeType);
  }

  async downloadFile(fileId) {
    const drive = this.getClient();
    const res = await drive.files.get({ fileId, alt: 'media', supportsAllDrives: true }, { responseType: 'stream' });
    return res.data;
  }

  async deleteFile(fileId) {
    const drive = this.getClient();
    await drive.files.delete({ fileId, supportsAllDrives: true });
  }

  async listFiles(folderId) {
    const drive = this.getClient();
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id,name,mimeType,size)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    return (res.data.files || []).map((f) => ({ fileId: f.id, name: f.name, mimeType: f.mimeType, size: Number(f.size || 0) }));
  }

  async shareFile(fileId, withUserId, permission) {
    const drive = this.getClient();
    await drive.permissions.create({
      fileId,
      requestBody: {
        type: 'user',
        role: permission === 'edit' ? 'writer' : 'reader',
        emailAddress: withUserId,
      },
      supportsAllDrives: true,
    });
  }

  async getFolderPath(folderId) {
    const drive = this.getClient();
    const path = [];
    let cursor = folderId;
    for (let i = 0; i < 10 && cursor; i += 1) {
      const res = await drive.files.get({ fileId: cursor, fields: 'id,name,parents', supportsAllDrives: true });
      path.unshift(res.data.name || res.data.id);
      cursor = res.data.parents?.[0] || null;
    }
    return path.join('/');
  }

  async getOrCreateFolder(parentFolderId = null, folderName) {
    const drive = this.getClient();
    const escapedName = folderName.replace(/'/g, "\\'");
    let q = `name = '${escapedName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    if (parentFolderId) {
      q += ` and '${parentFolderId}' in parents`;
    }
    const found = await drive.files.list({
      q,
      fields: 'files(id)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    if (found.data.files?.length) {
      return found.data.files[0].id;
    }
    const created = await this.createFolder(parentFolderId, folderName);
    return created.folderId;
  }

  async createDirectUploadSession({
    fileName,
    mimeType = 'application/octet-stream',
    folderId,
  }) {
    const drive = this.getClient();
    const response = await drive.files.create(
      {
        requestBody: { name: fileName, parents: [folderId], mimeType },
        media: { mimeType },
        fields: 'id',
        supportsAllDrives: true,
      },
      {
        headers: { 'X-Upload-Content-Type': mimeType },
        params: { uploadType: 'resumable' },
      }
    );

    return {
      provider: this.providerName,
      method: 'PUT',
      uploadUrl: response?.headers?.location,
      headers: {
        'Content-Type': mimeType,
      },
      providerFileId: response?.data?.id || null,
      objectKey: null,
    };
  }

  async verifyUploadedObject({ fileId, objectKey, folderId, expectedSize, expectedMimeType }) {
    const drive = this.getClient();
    const resolvedFileId = fileId || objectKey;
    if (!resolvedFileId) {
      return { ok: false, reason: 'missing_file_id' };
    }

    const res = await drive.files.get({
      fileId: resolvedFileId,
      fields: 'id,size,mimeType,parents,webViewLink',
      supportsAllDrives: true,
    });
    const data = res?.data || {};

    const parentMatch = !folderId || (Array.isArray(data.parents) && data.parents.includes(folderId));
    const sizeMatch = Number(data.size || 0) === Number(expectedSize || 0);
    const mimeMatch = !expectedMimeType || data.mimeType === expectedMimeType;
    if (!parentMatch || !sizeMatch || !mimeMatch) {
      return { ok: false, reason: 'metadata_mismatch' };
    }

    return {
      ok: true,
      provider: this.providerName,
      fileId: data.id,
      webViewLink: data.webViewLink || null,
    };
  }
}

module.exports = GoogleDriveProvider;
