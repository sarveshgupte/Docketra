const StorageProvider = require('./StorageProvider');
const { StorageAccessError, UnsupportedProviderFeatureError } = require('../errors');

class OneDriveProvider extends StorageProvider {
  constructor({ refreshToken, driveId }) {
    super();
    if (!refreshToken) {
      throw new StorageAccessError('[OneDriveProvider] refreshToken is required', 'unknown');
    }
    this.providerName = 'onedrive';
    this.refreshToken = refreshToken;
    this.driveId = driveId;
  }

  async getClient() {
    // "common" supports multi-tenant AAD apps; set ONEDRIVE_TENANT_ID to a specific tenant for single-tenant deployments.
    const { ONEDRIVE_CLIENT_ID, ONEDRIVE_CLIENT_SECRET, ONEDRIVE_TENANT_ID = 'common' } = process.env;
    if (!ONEDRIVE_CLIENT_ID || !ONEDRIVE_CLIENT_SECRET || !this.refreshToken) {
      const error = new StorageAccessError('[OneDriveProvider] OAuth configuration is incomplete', 'unknown');
      error.status = 500;
      throw error;
    }
    const body = new URLSearchParams({
      client_id: ONEDRIVE_CLIENT_ID,
      client_secret: ONEDRIVE_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: this.refreshToken,
    });
    const tokenRes = await fetch(`https://login.microsoftonline.com/${ONEDRIVE_TENANT_ID}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!tokenRes.ok) {
      const error = new StorageAccessError('[OneDriveProvider] Token refresh failed', 'unknown');
      error.status = Number(tokenRes.status) || 500;
      throw error;
    }
    const tokenData = await tokenRes.json();
    return async (path, options = {}) => {
      const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          ...(options.headers || {}),
        },
      });
      if (!response.ok) {
        const error = new StorageAccessError('[OneDriveProvider] Graph request failed', 'unknown');
        error.status = Number(response.status) || 500;
        throw error;
      }
      return response;
    };
  }

  async testConnection() {
    const client = await this.getClient();
    await client('/me/drive');
    return { healthy: true };
  }

  async createFolder(name, parentId = 'root') {
    const client = await this.getClient();
    const res = await client(`/drives/${this.driveId}/items/${parentId}/children`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'rename',
      }),
    });
    const data = await res.json();
    return { folderId: data.id };
  }

  async uploadFileStream({ folderId, filename, mimeType, stream }) {
    const client = await this.getClient();
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const body = Buffer.concat(chunks);
    const res = await client(`/drives/${this.driveId}/items/${folderId}:/${encodeURIComponent(filename)}:/content`, {
      method: 'PUT',
      headers: { 'Content-Type': mimeType || 'application/octet-stream' },
      body,
    });
    const data = await res.json();
    return { fileId: data.id };
  }

  async deleteFile(fileId) {
    const client = await this.getClient();
    await client(`/drives/${this.driveId}/items/${fileId}`, { method: 'DELETE' });
  }

  async getFileMetadata(fileId) {
    const client = await this.getClient();
    const res = await client(`/drives/${this.driveId}/items/${fileId}`);
    return res.json();
  }

  async uploadFile(parentOrPath, fileName, streamOrBuffer, mimeType = 'application/octet-stream') {
    const stream = streamOrBuffer?.pipe ? streamOrBuffer : require('stream').Readable.from(streamOrBuffer); // eslint-disable-line global-require
    return this.uploadFileStream({ folderId: parentOrPath || 'root', filename: fileName, mimeType, stream });
  }

  async downloadFile(fileId) {
    const client = await this.getClient();
    const res = await client(`/drives/${this.driveId}/items/${fileId}/content`);
    return res.body;
  }

  async listFiles(parentOrPath = 'root') {
    const client = await this.getClient();
    const res = await client(`/drives/${this.driveId}/items/${parentOrPath}/children`);
    const data = await res.json();
    return (data.value || []).map((item) => ({ fileId: item.id, name: item.name, mimeType: item.file?.mimeType || null, size: Number(item.size || 0) }));
  }

  async getOrCreateFolder() {
    throw new UnsupportedProviderFeatureError(this.providerName, 'getOrCreateFolder');
  }

  async generateDownloadUrl() {
    throw new UnsupportedProviderFeatureError(this.providerName, 'generateDownloadUrl');
  }
}

module.exports = OneDriveProvider;
