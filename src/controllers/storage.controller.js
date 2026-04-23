const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Firm = require('../models/Firm.model');
const { getCookieValue } = require('../utils/requestCookies');
const { isAdminRole, isPrimaryAdminRole } = require('../utils/role.utils');
const { encrypt, decrypt } = require('../services/storage/services/TokenEncryption.service');
const { googleDriveService, PROVIDER_TYPES } = require('../services/googleDrive.service');
const { storageBackupService } = require('../services/storageBackup.service');
const GoogleDriveProvider = require('../services/storage/providers/GoogleDriveProvider');
const OneDriveProvider = require('../services/storage/providers/OneDriveProvider');
const { StorageValidationError } = require('../services/storage/errors/StorageErrors');
const { StorageProviderFactory } = require('../services/storage/StorageProviderFactory');
const { S3Adapter } = require('../services/storageAdapter.service');
const { writeSettingsAudit } = require('../services/productAudit.service');
const { REASON_CODES, logPilotEvent } = require('../services/pilotDiagnostics.service');
const log = require('../utils/log');

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
];
const STATE_COOKIE_NAME = 'storage_oauth_state';
const STATE_TTL_SECONDS = 10 * 60;
const MANAGED_STORAGE_MODE = 'docketra_managed';
const SUPPORTED_STORAGE_PROVIDERS = new Set(['docketra_managed', 'google-drive', 'onedrive', 's3']);
const usedStorageOtpJti = new Map();
const STORAGE_AUDIT_SOURCES = Object.freeze({
  CHANGE_PROVIDER: 'storage.change_provider',
  EXPORT_GENERATE: 'storage.export_generate',
  EXPORT_DOWNLOAD: 'storage.export_download',
  BACKUP_LIST: 'storage.backup_list',
  DISCONNECT: 'storage.disconnect',
});

function decodeFirmStorageConfig(firm, firmId) {
  const encrypted = firm?.storageConfig?.credentials;
  if (!encrypted) return {};
  try {
    return JSON.parse(decrypt(encrypted));
  } catch (error) {
    log.error('[STORAGE]', {
      event: 'storage_credentials_decrypt_failed',
      firmId,
      message: error.message,
    });
    return {};
  }
}

function toUiProvider(provider) {
  if (provider === 'google_drive') return 'google-drive';
  return provider || 'docketra_managed';
}

function ensureFirmAdmin(req, res) {
  if (!isAdminRole(req.user?.role)) {
    res.status(403).json({ error: 'Only firm admin can manage storage connection' });
    return false;
  }
  return true;
}

function ensurePrimaryAdmin(req, res) {
  if (!isPrimaryAdminRole(req.user?.role)) {
    res.status(403).json({ error: 'Only Primary Admin can perform this action' });
    return false;
  }
  return true;
}


function ensureStorageOtpVerification(req, res) {
  const verificationToken = String(req.body?.verificationToken || '').trim();
  if (!verificationToken) {
    res.status(403).json({ error: 'storage_change_otp_required' });
    return false;
  }

  try {
    const decoded = jwt.verify(verificationToken, process.env.JWT_SECRET, {
      issuer: 'docketra',
      audience: 'docketra-api',
      algorithms: ['HS256'],
    });

    if (decoded?.type !== 'otp_verification' || decoded?.purpose !== 'storage_change') {
      res.status(403).json({ error: 'invalid_storage_change_verification' });
      return false;
    }

    const jti = String(decoded?.jti || '').trim();
    if (!jti) {
      res.status(403).json({ error: 'invalid_storage_change_verification' });
      return false;
    }

    const usedUntil = usedStorageOtpJti.get(jti);
    if (usedUntil && usedUntil > Date.now()) {
      res.status(403).json({ error: 'storage_change_verification_reused' });
      return false;
    }

    const expectedIdentifier = String(req.user?.primary_email || req.user?.email || '').trim().toLowerCase();
    if (!expectedIdentifier || decoded.identifier !== expectedIdentifier) {
      res.status(403).json({ error: 'storage_change_identifier_mismatch' });
      return false;
    }

    const expiryMs = Number(decoded?.exp || 0) * 1000;
    if (expiryMs > Date.now()) {
      usedStorageOtpJti.set(jti, expiryMs);
    }

    return true;
  } catch {
    res.status(403).json({ error: 'invalid_storage_change_verification' });
    return false;
  }
}
function getStorageOAuthClient() {
  return googleDriveService.getOAuthClient();
}

function buildStateToken(tenantId) {
  const nonce = crypto.randomBytes(16).toString('hex');
  const payload = Buffer.from(JSON.stringify({ tenantId, provider: 'google_drive', nonce })).toString('base64url');
  const sig = crypto.createHmac('sha256', process.env.JWT_SECRET).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

function verifyStateToken(cookieValue, stateParam) {
  if (!cookieValue || !stateParam || cookieValue !== stateParam) return null;
  const dotIdx = cookieValue.lastIndexOf('.');
  if (dotIdx === -1) return null;

  const payload = cookieValue.slice(0, dotIdx);
  const sig = cookieValue.slice(dotIdx + 1);
  const expectedSig = crypto.createHmac('sha256', process.env.JWT_SECRET).update(payload).digest('hex');

  let sigBuffer;
  let expectedBuffer;
  try {
    sigBuffer = Buffer.from(sig, 'hex');
    expectedBuffer = Buffer.from(expectedSig, 'hex');
  } catch {
    return null;
  }

  if (sigBuffer.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return null;

  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function buildStateCookie(value, maxAge) {
  const parts = [`${STATE_COOKIE_NAME}=${value}`, 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAge}`, 'Path=/'];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}

function mapProviderErrorToStatus(error) {
  const message = (error?.message || '').toLowerCase();
  if (error?.status === 401 || message.includes('invalid_grant')) return 'DISCONNECTED';
  if (error?.status === 403 && (message.includes('permission') || message.includes('insufficient'))) return 'DISCONNECTED';
  if (error?.status === 403 && message.includes('quota')) return 'QUOTA_EXCEEDED';
  return 'ERROR';
}

const getStorageStatus = async (req, res) => {
  try {
    const firm = await Firm.findById(req.firmId).select('storageConfig').lean();
    const credentials = decodeFirmStorageConfig(firm, req.firmId);
    const context = await googleDriveService.getClient(req.firmId);
    const status = credentials.status || (context.rootFolderId ? 'ACTIVE' : 'DISCONNECTED');

    return res.json({
      connected: Boolean(context.rootFolderId),
      provider: context.providerType || PROVIDER_TYPES.USER_GOOGLE_DRIVE,
      status,
      rootFolderId: context.rootFolderId || null,
      connectedEmail: credentials.connectedEmail || null,
      lastCheckedAt: credentials.lastCheckedAt || new Date().toISOString(),
    });
  } catch {
    return res.status(500).json({ error: 'Failed to retrieve storage status' });
  }
};

const getStorageHealth = async (req, res) => {
  try {
    const firm = await Firm.findById(req.firmId).select('storage storageConfig -_id').lean();

    const storageMode = firm?.storage?.mode || MANAGED_STORAGE_MODE;
    const usingManagedStorage = storageMode === MANAGED_STORAGE_MODE;
    const hasFirmStorageConfig = Boolean(firm?.storageConfig?.provider);
    const defaultStatus = usingManagedStorage || hasFirmStorageConfig ? 'HEALTHY' : 'DISCONNECTED';
    const defaultLastError = usingManagedStorage || hasFirmStorageConfig ? null : 'Active storage configuration not found';

    return res.json({
      status: defaultStatus,
      lastVerifiedAt: null,
      missingFilesCount: 0,
      sampleSize: 0,
      lastError: defaultLastError,
    });
  } catch {
    return res.status(500).json({ error: 'Failed to retrieve storage health' });
  }
};

const googleConnect = (req, res) => {
  if (!ensurePrimaryAdmin(req, res)) return;
  try {
    const oauthClient = getStorageOAuthClient();
    const stateToken = buildStateToken(req.firmId);

    const authUrl = oauthClient.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: GOOGLE_SCOPES,
      state: stateToken,
    });

    res.setHeader('Set-Cookie', buildStateCookie(stateToken, STATE_TTL_SECONDS));
    return res.redirect(authUrl);
  } catch {
    return res.status(503).json({ error: 'Google OAuth for storage is not configured' });
  }
};

const googleCallback = async (req, res) => {
  if (!ensurePrimaryAdmin(req, res)) return;
  try {
    const { code, state } = req.query;
    if (!code) return res.status(400).json({ error: 'missing_oauth_code' });
    if (!state) return res.status(400).json({ error: 'missing_state' });

    const cookieValue = req.cookies?.[STATE_COOKIE_NAME] || getCookieValue(req.headers.cookie, STATE_COOKIE_NAME);
    const stateData = verifyStateToken(cookieValue, state);
    if (!stateData || stateData.tenantId !== req.firmId || stateData.provider !== 'google_drive') {
      return res.status(400).json({ error: 'invalid_state' });
    }

    const oauthClient = getStorageOAuthClient();
    const result = await oauthClient.getToken(code);
    const tokens = result.tokens || {};
    if (!tokens.refresh_token) return res.status(400).json({ error: 'no_refresh_token' });

    const connection = await googleDriveService.saveUserDriveConnection({ firmId: req.firmId, tokens });

    res.setHeader('Set-Cookie', buildStateCookie('', 0));
    const successUrl = `${process.env.FRONTEND_URL || ''}/storage/success?provider=google-drive&connected=1&rootFolderId=${encodeURIComponent(connection.rootFolderId || '')}`;
    return res.redirect(successUrl);
  } catch (error) {
    if (error instanceof StorageValidationError) {
      return res.status(400).json({ error: 'storage_configuration_invalid', message: error.message });
    }
    return res.status(500).json({ error: 'oauth_failed', message: error.message });
  }
};

const googleConfirmDrive = async (req, res) => {
  if (!ensurePrimaryAdmin(req, res)) return;
  if (!ensureStorageOtpVerification(req, res)) return;
  const firmId = req.firmId;
  const { driveId } = req.body || {};
  if (!driveId) return res.status(400).json({ error: 'driveId is required' });

  try {
    const firm = await Firm.findById(firmId).select('name storageConfig').lean();
    const existingStorageConfig = decodeFirmStorageConfig(firm, firmId);
    if (!existingStorageConfig?.refreshToken) {
      return res.status(404).json({ error: 'No active Google storage session found' });
    }

    const firmName = firm?.name || `Firm-${firmId}`;
    const refreshToken = existingStorageConfig.refreshToken;

    const oauthClient = getStorageOAuthClient();
    oauthClient.setCredentials({ refresh_token: refreshToken });
    const provider = new GoogleDriveProvider({ oauthClient, driveId });

    const docketraFolderId = await provider.getOrCreateFolder(null, 'Docketra');
    const firmFolderId = await provider.getOrCreateFolder(docketraFolderId, firmName);

    await Firm.findByIdAndUpdate(firmId, {
      $set: {
        storageConfig: {
          provider: 'google_drive',
          credentials: encrypt(JSON.stringify({
            refreshToken,
            connectedEmail: existingStorageConfig.connectedEmail || null,
            driveId,
            rootFolderId: firmFolderId,
          })),
        },
      },
    });

    return res.json({ success: true, status: 'ACTIVE', rootFolderId: firmFolderId });
  } catch (error) {
    const mappedStatus = mapProviderErrorToStatus(error);
    return res.status(500).json({ error: 'confirm_drive_failed', status: mappedStatus });
  }
};

const getStorageConfiguration = async (req, res) => {
  try {
    const firmId = req.firmId;
    const firm = await Firm.findById(firmId).select('storageConfig settings.storageBackup').lean();
    const config = firm?.storageConfig;

    if (!config) {
      return res.json({ provider: 'docketra_managed', isConfigured: true, status: 'ACTIVE' });
    }
    const credentials = decodeFirmStorageConfig(firm, firmId);

    let folderPath = null;
    if (credentials.rootFolderId) {
      try {
        const provider = await StorageProviderFactory.getProvider(firmId);
        folderPath = await provider.getFolderPath(credentials.rootFolderId);
      } catch {
        folderPath = null;
      }
    }

    const backupSettings = firm?.settings?.storageBackup || {};
    return res.json({
      provider: toUiProvider(config.provider),
      isConfigured: true,
      status: 'ACTIVE',
      connectedEmail: credentials.connectedEmail || null,
      rootFolderId: credentials.rootFolderId || null,
      folderPath,
      createdAt: firm?.storageConfig?.createdAt || null,
      updatedAt: firm?.storageConfig?.updatedAt || null,
      backup: {
        enabled: Boolean(backupSettings.enabled),
        notificationRecipients: backupSettings.notificationRecipients || [],
        deliveryPolicy: backupSettings.deliveryPolicy || 'link_only',
        retentionDays: Number(backupSettings.retentionDays || 30),
      },
    });
  } catch {
    return res.status(500).json({ error: 'configuration_fetch_failed' });
  }
};

const testStorageConnection = async (req, res) => {
  try {
    const provider = await StorageProviderFactory.getProvider(req.firmId);
    if (typeof provider.testConnection === 'function') {
      await provider.testConnection();
    }
    return res.json({ success: true, message: 'Storage connection is healthy.' });
  } catch {
    return res.status(502).json({ success: false, error: 'storage_connection_failed' });
  }
};

const changeFirmStorage = async (req, res) => {
  if (!ensureFirmAdmin(req, res)) return;
  if (!ensureStorageOtpVerification(req, res)) return;

  const firmId = String(req.firmId || '');
  const provider = String(req.body?.provider || '').trim();
  const rawCredentials = req.body?.credentials || {};
  const backupSettings = req.body?.backupSettings || null;

  if (!SUPPORTED_STORAGE_PROVIDERS.has(provider)) {
    return res.status(400).json({ success: false, message: 'Unsupported storage provider' });
  }

  try {
    const existingFirmForAudit = await Firm.findById(firmId).select('storage storageConfig').lean();
    const previousProvider = existingFirmForAudit?.storage?.provider || 'docketra_managed';
    const previousMode = existingFirmForAudit?.storage?.mode || 'docketra_managed';

    let adapter = null;
    let effectiveRefreshToken = null;
    if (provider === 'docketra_managed') {
      adapter = { providerName: 'docketra_managed' };
    } else if (provider === 'google-drive') {
      const existingFirm = await Firm.findById(firmId).select('storageConfig').lean();
      const existingCredentials = decodeFirmStorageConfig(existingFirm, firmId);
      effectiveRefreshToken = rawCredentials?.googleRefreshToken || existingCredentials?.refreshToken || existingCredentials?.googleRefreshToken;

      if (!effectiveRefreshToken) {
        return res.status(400).json({ success: false, message: 'Connect Google Drive first, then save provider.' });
      }

      const oauthClient = getStorageOAuthClient();
      oauthClient.setCredentials({ refresh_token: effectiveRefreshToken });
      adapter = new GoogleDriveProvider({ oauthClient, driveId: rawCredentials.driveId || null });
      if (typeof adapter.testConnection === 'function') {
        await adapter.testConnection();
      }
    } else if (provider === 'onedrive') {
      if (!rawCredentials?.refreshToken) {
        return res.status(400).json({ success: false, message: 'refreshToken is required for OneDrive' });
      }
      adapter = new OneDriveProvider({
        refreshToken: rawCredentials.refreshToken,
        driveId: rawCredentials.driveId || null,
      });
      if (typeof adapter.testConnection === 'function') {
        await adapter.testConnection();
      }
    } else if (provider === 's3') {
      adapter = new S3Adapter(rawCredentials);
      await adapter.testConnection();
    }

    const normalizedCredentials = provider === 'google-drive'
      ? {
          ...rawCredentials,
          refreshToken: rawCredentials?.googleRefreshToken || rawCredentials?.refreshToken || effectiveRefreshToken || null,
          googleRefreshToken: undefined,
        }
      : rawCredentials;

    const encryptedCredentials = provider === 'docketra_managed'
      ? null
      : encrypt(JSON.stringify(normalizedCredentials || {}));

    const canonicalProvider = provider === 'google-drive' ? 'google_drive' : provider;
    await Firm.findByIdAndUpdate(firmId, {
      $set: {
        'storage.mode': provider === 'docketra_managed' ? 'docketra_managed' : 'firm_connected',
        'storage.provider': canonicalProvider,
        storageConfig: provider === 'docketra_managed'
          ? null
          : {
              provider: canonicalProvider,
              credentials: encryptedCredentials,
            },
        ...(backupSettings ? {
          'settings.storageBackup.enabled': Boolean(backupSettings.enabled),
          'settings.storageBackup.notificationRecipients': Array.isArray(backupSettings.notificationRecipients)
            ? backupSettings.notificationRecipients
            : [],
          'settings.storageBackup.deliveryPolicy': backupSettings.deliveryPolicy === 'attachment' ? 'attachment' : 'link_only',
          'settings.storageBackup.retentionDays': Math.min(Math.max(Number(backupSettings.retentionDays || 30), 1), 3650),
        } : {}),
      },
    });

    await writeSettingsAudit({
      req,
      tenantId: firmId,
      settingsKey: 'storage-config',
      action: 'CONFIG_CHANGED',
      oldDoc: {
        mode: previousMode,
        provider: previousProvider,
      },
      newDoc: {
        mode: provider === 'docketra_managed' ? 'docketra_managed' : 'firm_connected',
        provider: canonicalProvider,
      },
      metadata: {
        source: STORAGE_AUDIT_SOURCES.CHANGE_PROVIDER,
        provider: canonicalProvider,
      },
      dedupeKey: `firm-storage-change:${canonicalProvider}`,
    });

    return res.json({ success: true, data: { provider, isActive: true, tested: Boolean(adapter) } });
  } catch (error) {
    log.error('[STORAGE]', {
      event: 'change_provider_failed',
      firmId,
      provider,
      message: error.message,
    });
    return res.status(400).json({ success: false, message: error.message || 'Unable to update storage provider' });
  }
};

const exportFirmStorage = async (req, res) => {
  try {
    if (!ensurePrimaryAdmin(req, res)) return;
    const backup = await storageBackupService.runBackupForFirm(req.firmId, { sendEmail: true });
    const access = await storageBackupService.buildBackupAccess({
      firmId: req.firmId,
      exportId: backup.exportId,
    });
    const downloadUrl = access?.downloadUrl || null;
    if (downloadUrl) {
      try {
        await storageBackupService.emailBackupNotification({
          firmId: req.firmId,
          exportId: backup.exportId,
          downloadUrl,
          success: true,
        });
      } catch (emailError) {
        log.error('[STORAGE]', { event: 'backup_email_failed', firmId: req.firmId, message: emailError.message });
      }
    }

    log.info('[STORAGE]', { event: 'backup_generated', firmId: req.firmId, exportId: backup.exportId });
    await writeSettingsAudit({
      req,
      tenantId: req.firmId,
      settingsKey: 'storage-export',
      action: 'EXPORT_GENERATED',
      metadata: {
        source: STORAGE_AUDIT_SOURCES.EXPORT_GENERATE,
        exportId: backup.exportId,
        fileCount: backup.fileCount,
      },
      dedupeKey: `storage-export-generated:${backup.exportId}`,
    });
    logPilotEvent({
      event: 'storage_export_generated',
      metadata: { firmId: req.firmId, exportId: backup.exportId, fileCount: backup.fileCount || 0 },
    });
    return res.json({
      success: true,
      exportId: backup.exportId,
      fileCount: backup.fileCount,
      archiveObjectKey: backup.archiveObjectKey,
      checksum: backup.checksum,
      size: backup.size,
      downloadUrl,
      expiresInSeconds: access?.expiresInSeconds || null,
      deliveryPolicy: 'link_only',
    });
  } catch (error) {
    logPilotEvent({
      event: 'storage_export_failed',
      severity: 'warn',
      metadata: { firmId: req.firmId, reasonCode: REASON_CODES.STORAGE_EXPORT_FAILED },
    });
    await writeSettingsAudit({
      req,
      tenantId: req.firmId,
      settingsKey: 'storage-export',
      action: 'EXPORT_FAILED',
      metadata: {
        source: STORAGE_AUDIT_SOURCES.EXPORT_GENERATE,
        reasonCode: REASON_CODES.STORAGE_EXPORT_FAILED,
        message: error.message || null,
      },
    });
    return res.status(500).json({ error: 'export_failed', reasonCode: REASON_CODES.STORAGE_EXPORT_FAILED, message: error.message });
  }
};

const downloadFirmStorageExport = async (req, res) => {
  const { token } = req.params;
  const entry = await storageBackupService.buildBackupAccess({ firmId: req.firmId, exportId: token });
  if (!entry) return res.status(404).json({ error: 'invalid_or_expired_export_link' });

  if (!entry.downloadUrl) {
    logPilotEvent({
      event: 'storage_export_download_unavailable',
      severity: 'warn',
      metadata: { firmId: req.firmId, exportId: token, reasonCode: REASON_CODES.EXPORT_DOWNLOAD_UNAVAILABLE },
    });
    return res.status(409).json({
      error: 'download_link_unavailable_for_provider',
      reasonCode: REASON_CODES.EXPORT_DOWNLOAD_UNAVAILABLE,
      message: 'Download link is unavailable for the active storage provider. Use backup run metadata and support recovery path.',
    });
  }
  await writeSettingsAudit({
    req,
    tenantId: req.firmId,
    settingsKey: 'storage-export',
    action: 'EXPORT_DOWNLOAD_LINK_ISSUED',
    metadata: {
      source: STORAGE_AUDIT_SOURCES.EXPORT_DOWNLOAD,
      exportId: token,
    },
    dedupeKey: `storage-export-download:${token}`,
  });
  return res.redirect(entry.downloadUrl);
};

const listBackupRuns = async (req, res) => {
  try {
    if (!ensurePrimaryAdmin(req, res)) return;
    const items = await storageBackupService.listBackups(req.firmId, req.query?.limit || 20);
    return res.json({
      success: true,
      data: items,
    });
  } catch (error) {
    logPilotEvent({
      event: 'storage_backup_runs_fetch_failed',
      severity: 'warn',
      metadata: { firmId: req.firmId, reasonCode: REASON_CODES.BACKUP_RUNS_FETCH_FAILED },
    });
    return res.status(500).json({
      error: 'backup_runs_fetch_failed',
      reasonCode: REASON_CODES.BACKUP_RUNS_FETCH_FAILED,
      message: error.message,
    });
  }
};

const disconnectStorage = async (req, res) => {
  if (!ensurePrimaryAdmin(req, res)) return;
  try {
    const previous = await Firm.findById(req.firmId).select('storage').lean();
    await googleDriveService.markStorageDisconnected(req.firmId, 'Disconnected by primary admin');
    const next = await Firm.findById(req.firmId).select('storage').lean();
    await writeSettingsAudit({
      req,
      tenantId: req.firmId,
      settingsKey: 'storage-config',
      action: 'CONFIG_CHANGED',
      oldDoc: {
        mode: previous?.storage?.mode || null,
        provider: previous?.storage?.provider || null,
      },
      newDoc: {
        mode: next?.storage?.mode || null,
        provider: next?.storage?.provider || null,
      },
      metadata: { source: STORAGE_AUDIT_SOURCES.DISCONNECT },
      dedupeKey: 'storage-disconnect',
    });
    const context = await googleDriveService.getClient(req.firmId);
    return res.json({
      success: true,
      provider: context.providerType || PROVIDER_TYPES.USER_GOOGLE_DRIVE,
      rootFolderId: context.rootFolderId || null,
    });
  } catch (error) {
    return res.status(500).json({ error: 'disconnect_failed', message: error.message });
  }
};

const storageHealthCheck = async (req, res) => {
  try {
    const { drive } = await googleDriveService.getClient(req.firmId);
    await drive.files.list({ pageSize: 1, fields: 'files(id)', supportsAllDrives: true, includeItemsFromAllDrives: true });

    const firm = await Firm.findById(req.firmId).select('storageConfig').lean();
    const credentials = decodeFirmStorageConfig(firm, req.firmId);
    await Firm.findByIdAndUpdate(req.firmId, {
      $set: {
        storageConfig: {
          provider: 'google_drive',
          credentials: encrypt(JSON.stringify({
            ...credentials,
            status: 'ACTIVE',
            lastError: null,
            lastCheckedAt: new Date().toISOString(),
          })),
        },
      },
    });
    return res.json({ healthy: true });
  } catch (error) {
    const mappedStatus = mapProviderErrorToStatus(error);
    if (mappedStatus === 'DISCONNECTED') {
      await googleDriveService.markStorageDisconnected(req.firmId, error.message);
    } else {
      await googleDriveService.markStorageError(req.firmId, error.message);
    }
    return res.status(502).json({ healthy: false, error: error.message || 'health_check_failed' });
  }
};

const storageUsage = async (req, res) => {
  try {
    const files = await googleDriveService.listFiles(req.firmId);
    const totalSizeBytes = files.reduce((acc, file) => acc + Number(file.size || 0), 0);
    return res.json({
      totalFiles: files.length,
      totalSizeBytes,
    });
  } catch (error) {
    return res.status(500).json({ error: 'usage_failed', message: error.message });
  }
};

module.exports = {
  getStorageStatus,
  getStorageHealth,
  googleConnect,
  googleCallback,
  googleConfirmDrive,
  getStorageConfiguration,
  testStorageConnection,
  exportFirmStorage,
  downloadFirmStorageExport,
  disconnectStorage,
  storageHealthCheck,
  storageUsage,
  changeFirmStorage,
  listBackupRuns,
  buildStateCookie,
  mapProviderErrorToStatus,
};
