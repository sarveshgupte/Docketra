const { google } = require('googleapis');
const { Readable } = require('stream');
const BaseStorageProvider = require('./BaseStorageProvider');
const { encrypt, decrypt } = require('../../storage/services/TokenEncryption.service');
const FirmStorageConfig = require('../../../models/FirmStorageConfig.model');

class GoogleDriveStorageProvider extends BaseStorageProvider {
  constructor(storageConfig) {
    super();
    this.storageConfig = storageConfig;
    this.oauthClient = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_OAUTH_REDIRECT_URI
    );

    this.oauthClient.setCredentials({
      refresh_token: decrypt(storageConfig.encryptedRefreshToken),
      ...(storageConfig.encryptedAccessToken
        ? { access_token: decrypt(storageConfig.encryptedAccessToken) }
        : {}),
      ...(storageConfig.tokenExpiry
        ? { expiry_date: new Date(storageConfig.tokenExpiry).getTime() }
        : {}),
    });

    this.oauthClient.on('tokens', (tokens) => {
      this.persistTokenRefresh(tokens).catch((error) => {
        console.error('[GoogleDriveStorageProvider] Failed to persist refreshed token metadata', {
          storageConfigId: storageConfig._id?.toString?.(),
          message: error.message,
        });
      });
    });
  }

  async persistTokenRefresh(tokens = {}) {
    const update = {};
    if (tokens.access_token) update.encryptedAccessToken = encrypt(tokens.access_token);
    if (tokens.refresh_token) update.encryptedRefreshToken = encrypt(tokens.refresh_token);
    if (tokens.expiry_date) update.tokenExpiry = new Date(tokens.expiry_date);

    if (Object.keys(update).length === 0) return;

    await FirmStorageConfig.updateOne(
      { _id: this.storageConfig._id },
      {
        $set: {
          ...update,
          status: 'ACTIVE',
        },
      }
    );
  }

  get driveClient() {
    return google.drive({ version: 'v3', auth: this.oauthClient });
  }

  async uploadFile({ file, fileName, mimeType, parentFolderId }) {
    try {
      const upload = await this.driveClient.files.create({
        requestBody: {
          name: fileName,
          ...(parentFolderId ? { parents: [parentFolderId] } : {}),
        },
        media: {
          mimeType,
          body: Buffer.isBuffer(file) ? Readable.from(file) : file,
        },
        supportsAllDrives: true,
        fields: 'id,name,mimeType,size,createdTime',
      });

      return {
        providerFileId: upload.data.id,
        fileName: upload.data.name,
        fileType: upload.data.mimeType,
        size: Number(upload.data.size || 0),
      };
    } catch (error) {
      throw this.normalizeGoogleError(error);
    }
  }

  async getFile({ providerFileId }) {
    try {
      const streamResponse = await this.driveClient.files.get(
        {
          fileId: providerFileId,
          alt: 'media',
          supportsAllDrives: true,
        },
        { responseType: 'stream' }
      );

      const metadataResponse = await this.driveClient.files.get({
        fileId: providerFileId,
        fields: 'id,name,mimeType,size',
        supportsAllDrives: true,
      });

      return {
        stream: streamResponse.data,
        metadata: {
          fileName: metadataResponse.data.name,
          fileType: metadataResponse.data.mimeType,
          size: Number(metadataResponse.data.size || 0),
        },
      };
    } catch (error) {
      throw this.normalizeGoogleError(error);
    }
  }

  normalizeGoogleError(error) {
    const status = error?.response?.status || error?.code || 500;
    const message = (error?.response?.data?.error?.message || error?.message || 'Google Drive request failed').toLowerCase();

    if (status === 401 || message.includes('invalid_grant')) {
      const wrapped = new Error('Storage token expired or revoked');
      wrapped.code = 'TOKEN_EXPIRED';
      wrapped.status = 401;
      return wrapped;
    }

    if (status === 403 && (message.includes('quota') || message.includes('storage quota'))) {
      const wrapped = new Error('Storage quota exceeded');
      wrapped.code = 'STORAGE_QUOTA_EXCEEDED';
      wrapped.status = 403;
      return wrapped;
    }

    const wrapped = new Error('File upload/download failed');
    wrapped.code = 'UPLOAD_FAILED';
    wrapped.status = Number(status) || 500;
    return wrapped;
  }
}

module.exports = GoogleDriveStorageProvider;
