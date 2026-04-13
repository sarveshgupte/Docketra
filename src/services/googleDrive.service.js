const { google } = require('googleapis');
const { Readable } = require('stream');
const Firm = require('../models/Firm.model');
const { encrypt, decrypt } = require('./storage/services/TokenEncryption.service');

const PROVIDER_TYPES = {
  USER_GOOGLE_DRIVE: 'USER_GOOGLE_DRIVE',
  DOCKETRA_DRIVE: 'DOCKETRA_DRIVE',
};

class GoogleDriveService {
  getOAuthClient() {
    const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI } = process.env;
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_OAUTH_REDIRECT_URI) {
      throw new Error('Google OAuth environment variables are not fully configured');
    }
    return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI);
  }

  getServiceAccountAuth() {
    const raw = process.env.DOCKETRA_GOOGLE_SERVICE_ACCOUNT;
    if (!raw) {
      throw new Error('DOCKETRA_GOOGLE_SERVICE_ACCOUNT is not configured');
    }

    let credentials = null;
    try {
      credentials = JSON.parse(raw);
    } catch {
      throw new Error('DOCKETRA_GOOGLE_SERVICE_ACCOUNT must be valid JSON');
    }

    return new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
  }

  decodeStorageCredentials(firm) {
    if (!firm?.storageConfig?.credentials) return {};
    try {
      return JSON.parse(decrypt(firm.storageConfig.credentials));
    } catch {
      return {};
    }
  }

  async ensureDocketraRootFolder(firm) {
    const driveRootFolderId = process.env.DRIVE_ROOT_FOLDER_ID;
    if (!driveRootFolderId) {
      throw new Error('DRIVE_ROOT_FOLDER_ID is not configured');
    }

    const auth = this.getServiceAccountAuth();
    const drive = google.drive({ version: 'v3', auth });

    const existingFolderId = firm?.storage?.google?.rootFolderId
      || this.decodeStorageCredentials(firm)?.rootFolderId
      || null;

    if (existingFolderId) {
      return { drive, rootFolderId: existingFolderId };
    }

    const firmId = firm?._id?.toString?.() || firm?.firmId;
    const folder = await drive.files.create({
      requestBody: {
        name: `Firm-${firmId}`,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [driveRootFolderId],
      },
      supportsAllDrives: true,
      fields: 'id',
    });

    const rootFolderId = folder.data.id;

    await Firm.findByIdAndUpdate(firmId, {
      $set: {
        'storage.mode': 'docketra_managed',
        'storage.provider': 'google_drive',
        'storage.google.rootFolderId': rootFolderId,
      },
    });

    return { drive, rootFolderId };
  }

  async getClient(firmId) {
    const firm = await Firm.findById(firmId).select('storage storageConfig firmId').lean();
    if (!firm) {
      throw new Error('Firm not found');
    }

    const credentials = this.decodeStorageCredentials(firm);
    const hasRefreshToken = Boolean(credentials.refreshToken || credentials.googleRefreshToken);

    if (hasRefreshToken) {
      const oauthClient = this.getOAuthClient();
      oauthClient.setCredentials({
        refresh_token: credentials.refreshToken || credentials.googleRefreshToken,
        access_token: credentials.accessToken || undefined,
        expiry_date: credentials.expiryDate || undefined,
      });

      const drive = google.drive({ version: 'v3', auth: oauthClient });
      return {
        drive,
        firm,
        providerType: PROVIDER_TYPES.USER_GOOGLE_DRIVE,
        rootFolderId: credentials.rootFolderId || firm?.storage?.google?.rootFolderId,
      };
    }

    const managed = await this.ensureDocketraRootFolder(firm);
    return {
      drive: managed.drive,
      firm,
      providerType: PROVIDER_TYPES.DOCKETRA_DRIVE,
      rootFolderId: managed.rootFolderId,
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
  }

  async listFiles(firmId) {
    const { drive, rootFolderId } = await this.getClient(firmId);
    if (!rootFolderId) throw new Error('Firm storage rootFolderId is missing');

    const files = await drive.files.list({
      q: `'${rootFolderId}' in parents and trashed = false`,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      fields: 'files(id,name,mimeType,size,createdTime,modifiedTime)',
    });

    return files.data.files || [];
  }

  async downloadFile(firmId, fileId) {
    const { drive } = await this.getClient(firmId);
    const file = await drive.files.get(
      { fileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'stream' }
    );
    return file.data;
  }

  async saveUserDriveConnection({ firmId, tokens }) {
    const oauthClient = this.getOAuthClient();
    oauthClient.setCredentials(tokens);
    const drive = google.drive({ version: 'v3', auth: oauthClient });

    const firmFolderId = await this.createFolder(`Docketra-${firmId}`, null, drive);

    const storageCredentials = {
      accessToken: tokens.access_token || null,
      refreshToken: tokens.refresh_token || null,
      expiryDate: tokens.expiry_date || null,
      rootFolderId: firmFolderId,
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
