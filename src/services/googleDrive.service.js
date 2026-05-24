const { google } = require('googleapis');
const { Readable } = require('stream');
const Firm = require('../models/Firm.model');
const { encrypt, decrypt } = require('./storage/services/TokenEncryption.service');
const log = require('../utils/log');

const PROVIDER_TYPES = {
  USER_GOOGLE_DRIVE: 'USER_GOOGLE_DRIVE',
};
const ROOT_MANIFEST_FILE = '.docketra-storage-root.json';

class GoogleDriveService {
  buildCanonicalRootName(firm) {
    const slug = String(firm?.slug || firm?.firmSlug || '').trim();
    const suffix = slug || String(firm?._id || firm?.firmId || '');
    return `Docketra — ${suffix}`;
  }

  buildRootManifest({ firm, rootFolderId, createdAt = null }) {
    const now = new Date().toISOString();
    return {
      schemaVersion: 1,
      docketraStorageRoot: true,
      firmId: String(firm?._id || ''),
      firmSlug: String(firm?.slug || firm?.firmSlug || '') || null,
      provider: 'google_drive',
      rootFolderId: String(rootFolderId),
      createdAt: createdAt || now,
      updatedAt: now,
      environment: process.env.NODE_ENV || 'development',
    };
  }

  validateOAuthEnvironment() {
    const required = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_OAUTH_REDIRECT_URI', 'FRONTEND_URL'];
    const missing = required.filter((key) => !process.env[key]);
    const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || '';
    const hasValidCallback = /\/api\/storage\/google\/callback\/?$/.test(redirectUri);
    return {
      valid: missing.length === 0 && hasValidCallback,
      missing,
      hasValidCallback,
      redirectUri,
    };
  }

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
      log.error('[STORAGE]', {
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
    const validation = this.validateOAuthEnvironment();
    if (!validation.valid) {
      const reason = validation.missing.length
        ? `missing=${validation.missing.join(',')}`
        : 'redirect_uri_must_end_with_/api/storage/google/callback';
      throw new Error(`Google OAuth environment variables are not fully configured (${reason})`);
    }
    const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI } = process.env;
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

  async upsertRootManifest({ drive, rootFolderId, manifest }) {
    const found = await drive.files.list({
      q: `'${rootFolderId}' in parents and name = '${ROOT_MANIFEST_FILE}' and trashed = false`,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      fields: 'files(id)',
    });
    const body = JSON.stringify(manifest, null, 2);
    const media = { mimeType: 'application/json', body: Readable.from(body) };
    if (found.data.files?.[0]?.id) {
      await drive.files.update({ fileId: found.data.files[0].id, media, supportsAllDrives: true });
      return found.data.files[0].id;
    }
    const created = await drive.files.create({
      requestBody: { name: ROOT_MANIFEST_FILE, parents: [rootFolderId] },
      media,
      supportsAllDrives: true,
      fields: 'id',
    });
    return created.data.id;
  }

  async validateRootFolder({ drive, firm, rootFolderId }) {
    if (!rootFolderId) return { valid: false, code: 'STORAGE_ROOT_MISSING' };
    let folder = null;
    try {
      const folderRes = await drive.files.get({ fileId: rootFolderId, fields: 'id,name,trashed', supportsAllDrives: true });
      folder = folderRes.data;
    } catch {
      return { valid: false, code: 'STORAGE_ROOT_MISSING' };
    }
    if (folder?.trashed) return { valid: false, code: 'STORAGE_ROOT_MISSING' };
    const files = await drive.files.list({
      q: `'${rootFolderId}' in parents and name = '${ROOT_MANIFEST_FILE}' and trashed = false`,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      fields: 'files(id)',
    });
    const manifestFileId = files.data.files?.[0]?.id;
    if (!manifestFileId) return { valid: false, code: 'STORAGE_MANIFEST_MISSING' };
    const manifestRaw = await drive.files.get({ fileId: manifestFileId, alt: 'media', supportsAllDrives: true }, { responseType: 'stream' });
    const chunks = [];
    for await (const chunk of manifestRaw.data) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    const manifest = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!manifest?.docketraStorageRoot || String(manifest?.firmId || '') !== String(firm?._id || '') || String(manifest?.rootFolderId || '') !== String(rootFolderId)) {
      return { valid: false, code: 'STORAGE_ROOT_MISMATCH' };
    }
    return { valid: true, folderName: folder?.name || null };
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
      log.error('[STORAGE]', { event: 'upload_failed', firmId, message: error.message });
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

  buildCanonicalFirmFolderName(firm) {
    return this.buildCanonicalRootName(firm);
  }

  async saveUserDriveConnection({ firmId, tokens }) {
    const oauthClient = this.getOAuthClient();
    oauthClient.setCredentials(tokens);
    const drive = google.drive({ version: 'v3', auth: oauthClient });

    const firm = await Firm.findById(firmId).select('_id slug firmSlug storage storageConfig').lean();
    const decoded = this.decodeStorageCredentials(firm);
    let firmFolderId = decoded.rootFolderId || firm?.storage?.google?.rootFolderId || null;
    let verifiedFolderName = null;
    let connectedAt = decoded.connectedAt || null;
    if (firmFolderId) {
      const existing = await this.validateRootFolder({ drive, firm, rootFolderId: firmFolderId });
      if (!existing.valid) {
        const error = new Error(existing.code);
        error.code = existing.code;
        error.status = 409;
        throw error;
      }
      verifiedFolderName = existing.folderName || null;
    } else {
      firmFolderId = await this.createFolder(this.buildCanonicalRootName(firm), null, drive);
      connectedAt = new Date().toISOString();
      await this.upsertRootManifest({
        drive,
        rootFolderId: firmFolderId,
        manifest: this.buildRootManifest({ firm, rootFolderId: firmFolderId, createdAt: connectedAt }),
      });
      verifiedFolderName = this.buildCanonicalRootName(firm);
    }
    const about = await drive.about.get({ fields: 'user(emailAddress)' });
    const connectedEmail = about?.data?.user?.emailAddress || null;

    const storageCredentials = {
      refreshToken: tokens.refresh_token || null,
      expiryDate: tokens.expiry_date || null,
      rootFolderId: firmFolderId,
      connectedEmail,
      rootFolderName: verifiedFolderName,
      connectedAt,
      lastVerifiedAt: new Date().toISOString(),
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
