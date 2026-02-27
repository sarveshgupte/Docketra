const { StorageProvider } = require('../StorageProvider.interface');

class OneDriveProvider extends StorageProvider {
  constructor({ refreshToken, driveId }) {
    super();
    this.providerName = 'onedrive';
    this.refreshToken = refreshToken;
    this.driveId = driveId;
  }

  async getClient() {
    const { ONEDRIVE_CLIENT_ID, ONEDRIVE_CLIENT_SECRET, ONEDRIVE_TENANT_ID = 'common' } = process.env;
    if (!ONEDRIVE_CLIENT_ID || !ONEDRIVE_CLIENT_SECRET || !this.refreshToken) {
      throw new Error('[OneDriveProvider] OAuth configuration is incomplete');
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
      const error = new Error('[OneDriveProvider] Token refresh failed');
      error.status = tokenRes.status;
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
        const error = new Error('[OneDriveProvider] Graph request failed');
        error.status = response.status;
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
}

module.exports = OneDriveProvider;
