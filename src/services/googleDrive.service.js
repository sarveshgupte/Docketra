const { google } = require('googleapis');
const { Readable } = require('stream');
const Firm = require('../models/Firm.model');
const { encrypt, decrypt } = require('./storage/services/TokenEncryption.service');

const PROVIDER_TYPES = {
  USER_GOOGLE_DRIVE: 'USER_GOOGLE_DRIVE',
};

class GoogleDriveService {
  async persistStorageCredentials(firmId, nextCredentials = {}, provider = 'google_drive') {
    const encryptedCredentials = encrypt(JSON.stringify(nextCredentials));
    await Firm.findByIdAndUpdate(firmId, {
      $set: {
        storageConfig: {
          provider,
          credentials: encryptedCredentials,
        },
      },
    });
  }

  async markStorageDisconnected(firmId, errorMessage = null) {
    const firm = await Firm.findById(firmId).select('storageConfig storage').lean();
    const current = this.decodeStorageCredentials(firm);
    const nextCredentials = {
      ...current,
      accessToken: null,
      refreshToken: null,
      googleRefreshToken: null,
      expiryDate: null,
      status: 'DISCONNECTED',
      lastError: errorMessage || current.lastError || null,
      lastCheckedAt: new Date().toISOString(),
    };

    await Firm.findByIdAndUpdate(firmId, {
      $set: {
        'storage.mode': 'firm_connected',
        'storage.provider': 'google_drive',
        'storage.google.rootFolderId': null,
        'storage.google.encryptedRefreshToken': null,
      },
    });
    await this.persistStorageCredentials(firmId, nextCredentials, 'google_drive');
  }

  async markStorageError(firmId, errorMessage) {
    const firm = await Firm.findById(firmId).select('storageConfig').lean();
    const current = this.decodeStorageCredentials(firm);
    await this.persistStorageCredentials(
      firmId,
      {
        ...current,
        status: 'ERROR',
        lastError: errorMessage || null,
        lastCheckedAt: new Date().toISOString(),
      },
      'google_drive'
    );
  }

  async handleProviderError(firmId, error) {
    const message = (error?.message || '').toLowerCase();
    const isDisconnectedError = error?.status === 401
      || message.includes('invalid_grant')
      || message.includes('token has been expired')
      || message.includes('revoked');
    const isPermissionError = error?.status === 403
      || message.includes('insufficient permissions')
      || message.includes('permission');

    if (isDisconnectedError || isPermissionError) {
      await this.markStorageDisconnected(firmId, error?.message || 'Storage token disconnected');
      console.error('[STORAGE]', {
        event: 'token_expired',
        firmId,
        status: error?.status || null,
        message: error?.message,
      });
      return;
    }

    await this.markStorageError(firmId, error?.message || 'Storage provider failure');
  }

  getOAuthClient() {
    const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI } = process.env;
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_OAUTH_REDIRECT_URI) {
      throw new Error('Google OAuth environment variables are not fully configured');
    }
    return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI);
  }

  decodeStorageCredentials(firm) {
    if (!firm?.storageConfig?.credentials) return {};
    try {
      return JSON.parse(decrypt(firm.storageConfig.credentials));
    } catch {
      return {};
    }
  }

  async getClient(firmId) {
    const firm = await Firm.findById(firmId).select('storage storageConfig firmId').lean();
    if (!firm) {
      throw new Error('Firm not found');
    }

    const credentials = this.decodeStorageCredentials(firm);
    const refreshToken = credentials.refreshToken || credentials.googleRefreshToken;
    if (!refreshToken) {
      const error = new Error('Cloud storage must be connected');
      error.code = 'STORAGE_NOT_CONNECTED';
      error.status = 400;
      throw error;
    }

    const oauthClient = this.getOAuthClient();
    oauthClient.setCredentials({
      refresh_token: refreshToken,
      access_token: credentials.accessToken || undefined,
      expiry_date: credentials.expiryDate || undefined,
    });

    const rootFolderId = credentials.rootFolderId || firm?.storage?.google?.rootFolderId || null;
    if (!rootFolderId) {
      const error = new Error('Cloud storage must be connected');
      error.code = 'STORAGE_NOT_CONNECTED';
      error.status = 400;
      throw error;
    }

    const drive = google.drive({ version: 'v3', auth: oauthClient });
    return {
      drive,
      firm,
      providerType: PROVIDER_TYPES.USER_GOOGLE_DRIVE,
      rootFolderId,
    };
  }

  async createFolder(name, parentId, driveClient) {
    const folder = await driveClient.files.create({
      requestBody: {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        ...(parentId ? { parents: [parentId] } : {}),
      },
      supportsAllDrives: true,
      fields: 'id',
    });

    return folder.data.id;
  }

  async uploadFile(firmId, file) {
    try {
      const { drive, rootFolderId } = await this.getClient(firmId);
      if (!rootFolderId) throw new Error('Firm storage rootFolderId is missing');

      const body = file?.buffer ? Readable.from(file.buffer) : file?.stream;
      if (!body) throw new Error('File stream/buffer is required');

      const upload = await drive.files.create({
        requestBody: {
          name: file.originalname || file.filename || 'upload.bin',
          parents: [rootFolderId],
        },
        media: {
          mimeType: file.mimetype || 'application/octet-stream',
          body,
        },
        supportsAllDrives: true,
        fields: 'id,name,webViewLink,mimeType,size,createdTime',
      });

      return upload.data;
    } catch (error) {
      console.error('[STORAGE]', { event: 'upload_failed', firmId, message: error.message });
      await this.handleProviderError(firmId, error);
      throw error;
    }
  }

  async listFiles(firmId) {
    try {
      const { drive, rootFolderId } = await this.getClient(firmId);
      if (!rootFolderId) throw new Error('Firm storage rootFolderId is missing');

      const files = await drive.files.list({
        q: `'${rootFolderId}' in parents and trashed = false`,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        fields: 'files(id,name,mimeType,size,createdTime,modifiedTime)',
      });

      return files.data.files || [];
    } catch (error) {
      await this.handleProviderError(firmId, error);
      throw error;
    }
  }

  async downloadFile(firmId, fileId) {
    try {
      const { drive } = await this.getClient(firmId);
      const file = await drive.files.get(
        { fileId, alt: 'media', supportsAllDrives: true },
        { responseType: 'stream' }
      );
      return file.data;
    } catch (error) {
      await this.handleProviderError(firmId, error);
      throw error;
    }
  }

  async saveUserDriveConnection({ firmId, tokens }) {
    const oauthClient = this.getOAuthClient();
    oauthClient.setCredentials(tokens);
    const drive = google.drive({ version: 'v3', auth: oauthClient });

    const firmFolderId = await this.createFolder(`Docketra-${firmId}`, null, drive);
    const about = await drive.about.get({ fields: 'user(emailAddress)' });
    const connectedEmail = about?.data?.user?.emailAddress || null;

    const storageCredentials = {
      accessToken: tokens.access_token || null,
      refreshToken: tokens.refresh_token || null,
      expiryDate: tokens.expiry_date || null,
      rootFolderId: firmFolderId,
      connectedEmail,
      status: 'ACTIVE',
      lastError: null,
      lastCheckedAt: new Date().toISOString(),
    };

    await Firm.findByIdAndUpdate(firmId, {
      $set: {
        storageConfig: {
          provider: 'google_drive',
          credentials: encrypt(JSON.stringify(storageCredentials)),
        },
        'storage.mode': 'firm_connected',
        'storage.provider': 'google_drive',
        'storage.google.rootFolderId': firmFolderId,
        'storage.google.encryptedRefreshToken': storageCredentials.refreshToken
          ? encrypt(storageCredentials.refreshToken)
          : null,
      },
    });

    return { rootFolderId: firmFolderId };
  }
}

module.exports = {
  GoogleDriveService,
  googleDriveService: new GoogleDriveService(),
  PROVIDER_TYPES,
};
