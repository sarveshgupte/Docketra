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
const { resolveFirmStorageState, normalizeProvider } = require('../services/storage/resolveFirmStorageState');
const { S3Provider } = require('../services/storage/providers/S3Provider');
const { supportsListFiles, supportsHealthCheck } = require('../services/storage/providerCapabilities');
const { writeSettingsAudit } = require('../services/productAudit.service');
const { REASON_CODES, logPilotEvent } = require('../services/pilotDiagnostics.service');
const { resolveStorageContextFromTenantId } = require('../services/tenantIdentity.service');
const log = require('../utils/log');

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
];
const STATE_COOKIE_NAME = 'storage_oauth_state';
const STATE_TTL_SECONDS = 10 * 60;
const MANAGED_STORAGE_MODE = 'docketra_managed';
const SUPPORTED_STORAGE_PROVIDERS = new Set(['docketra_managed', 'google_drive', 'onedrive', 's3']);
const usedStorageOtpJti = new Map();

function pruneUsedStorageOtpJti(nowMs = Date.now()) {
  for (const [jti, expiresAtMs] of usedStorageOtpJti.entries()) {
    if (!expiresAtMs || expiresAtMs <= nowMs) usedStorageOtpJti.delete(jti);
  }
}
const STORAGE_AUDIT_SOURCES = Object.freeze({
  CHANGE_PROVIDER: 'storage.change_provider',
  EXPORT_GENERATE: 'storage.export_generate',
  EXPORT_DOWNLOAD: 'storage.export_download',
  BACKUP_LIST: 'storage.backup_list',
  DISCONNECT: 'storage.disconnect',
});
const isProduction = () => process.env.NODE_ENV === 'production';

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
  const normalized = normalizeProvider(provider);
  if (normalized === 'google_drive') return 'google-drive';
  return normalized || 'docketra_managed';
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


function getResolvedOwnershipAuditTenantId(ownershipFirmId, req) {
  return ownershipFirmId || req.ownershipFirmId || req.firm?.ownershipFirmId || null;
}

async function resolveOwnershipFirmIdForWrite(req, res) {
  const resolved = req.ownershipFirmId || req.firm?.ownershipFirmId;
  if (resolved) return resolved;
  const context = await resolveStorageContextFromTenantId(req.firmId);
  if (!context?.ownershipFirmId) {
    log.warn('[STORAGE]', { event: 'ownership_resolution_failed', tenantId: req.firmId, path: req.originalUrl });
    res.status(400).json({ error: 'Tenant mapping missing' });
    return null;
  }
  return context.ownershipFirmId;
}

async function resolveOwnershipFirmIdForRead(req) {
  const resolved = req.ownershipFirmId || req.firm?.ownershipFirmId;
  if (resolved) return resolved;
  const context = await resolveStorageContextFromTenantId(req.firmId);
  if (context?.ownershipFirmId) return context.ownershipFirmId;
  if (req.firmId) {
    log.warn('[STORAGE]', {
      event: 'ownership_read_fallback_to_tenant',
      tenantId: req.firmId,
      path: req.originalUrl,
    });
    return req.firmId;
  }
  return null;
}


function ensureStorageOtpVerification(req, res) {
  const verificationToken = String(req.body?.verificationToken || '').trim();
  if (!verificationToken) {
    res.status(403).json({ error: 'storage_change_otp_required' });
    return false;
  }

  try {
    pruneUsedStorageOtpJti();
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
  const sameSite = 'Lax';
  const parts = [`${STATE_COOKIE_NAME}=${value}`, 'HttpOnly', `SameSite=${sameSite}`, `Max-Age=${maxAge}`, 'Path=/'];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}

function buildFrontendStorageRedirect({ firmSlug, params = {} }) {
  const base = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
  const path = firmSlug
    ? `/app/firm/${encodeURIComponent(firmSlug)}/storage-settings`
    : '/storage/success';
  const query = new URLSearchParams(params).toString();
  return `${base}${path}${query ? `?${query}` : ''}`;
}

async function resolveFirmSlugForRedirect(firmId) {
  if (!firmId) return null;
  const firm = await Firm.findById(firmId).select('slug firmSlug').lean();
  return firm?.slug || firm?.firmSlug || null;
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
    const ownershipFirmId = await resolveOwnershipFirmIdForWrite(req, res); if (!ownershipFirmId) return;
    const firm = await Firm.findById(ownershipFirmId).select('storageConfig').lean();
    const credentials = decodeFirmStorageConfig(firm, ownershipFirmId);
    const context = await googleDriveService.getClient(ownershipFirmId);
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
    const ownershipFirmId = await resolveOwnershipFirmIdForWrite(req, res); if (!ownershipFirmId) return;
    const firm = await Firm.findById(ownershipFirmId).select('storage storageConfig -_id').lean();

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
    const validation = googleDriveService.validateOAuthEnvironment();
    if (!validation.valid) {
      log.warn('[STORAGE]', { event: 'google_oauth_env_invalid', missing: validation.missing, callbackMatchesRequiredRoute: validation.hasValidCallback });
      return res.status(503).json({ error: 'google_oauth_not_configured' });
    }
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
  if (!isPrimaryAdminRole(req.user?.role) || !req.firmId) {
    const firmSlug = await resolveFirmSlugForRedirect(req.firmId);
    log.warn('[STORAGE]', {
      event: 'google_oauth_callback_session_missing',
      hasUser: Boolean(req.user),
      hasFirmId: Boolean(req.firmId),
    });
    return res.redirect(buildFrontendStorageRedirect({
      firmSlug,
      params: { error: 'oauth_failed', reason: 'session_missing', provider: 'google-drive' },
    }));
  }
  try {
    const firmSlug = await resolveFirmSlugForRedirect(req.firmId);
    const { code, state } = req.query;
    if (!code) return res.redirect(buildFrontendStorageRedirect({ firmSlug, params: { error: 'oauth_failed', reason: 'missing_code', provider: 'google-drive' } }));
    if (!state) return res.redirect(buildFrontendStorageRedirect({ firmSlug, params: { error: 'oauth_failed', reason: 'missing_state', provider: 'google-drive' } }));

    const cookieValue = req.cookies?.[STATE_COOKIE_NAME] || getCookieValue(req.headers.cookie, STATE_COOKIE_NAME);
    const stateData = verifyStateToken(cookieValue, state);
    if (!stateData || stateData.tenantId !== req.firmId || stateData.provider !== 'google_drive') {
      res.setHeader('Set-Cookie', buildStateCookie('', 0));
      return res.redirect(buildFrontendStorageRedirect({ firmSlug, params: { error: 'oauth_failed', reason: 'invalid_state', provider: 'google-drive' } }));
    }

    const oauthClient = getStorageOAuthClient();
    const result = await oauthClient.getToken(code);
    const tokens = result.tokens || {};
    if (!tokens.refresh_token) return res.redirect(buildFrontendStorageRedirect({ firmSlug, params: { error: 'oauth_failed', reason: 'no_refresh_token', provider: 'google-drive' } }));

    const ownershipFirmId = await resolveOwnershipFirmIdForWrite(req, res); if (!ownershipFirmId) return;
    const connection = await googleDriveService.saveUserDriveConnection({ firmId: ownershipFirmId, tokens });

    res.setHeader('Set-Cookie', buildStateCookie('', 0));
    const successUrl = buildFrontendStorageRedirect({
      firmSlug,
      params: { provider: 'google-drive', connected: '1', rootFolderId: connection.rootFolderId || '' },
    });
    return res.redirect(successUrl);
  } catch (error) {
    if (error instanceof StorageValidationError) {
      const firmSlug = await resolveFirmSlugForRedirect(req.firmId);
      return res.redirect(buildFrontendStorageRedirect({ firmSlug, params: { error: 'oauth_failed', reason: 'storage_configuration_invalid', provider: 'google-drive' } }));
    }
    log.error('[STORAGE]', { event: 'oauth_failed', tenantId: req.firmId, message: error.message });
    const firmSlug = await resolveFirmSlugForRedirect(req.firmId);
    return res.redirect(buildFrontendStorageRedirect({ firmSlug, params: { error: 'oauth_failed', reason: 'oauth_failed', provider: 'google-drive' } }));
  }
};

const googleConfirmDrive = async (req, res) => {
  // Advanced/manual endpoint: used when a firm explicitly confirms a target
  // drive context (for example, shared drive selection) after OAuth connect.
  if (!ensurePrimaryAdmin(req, res)) return;
  if (!ensureStorageOtpVerification(req, res)) return;
  const ownershipFirmId = await resolveOwnershipFirmIdForWrite(req, res); if (!ownershipFirmId) return;
  const { driveId } = req.body || {};
  if (!driveId) return res.status(400).json({ error: 'driveId is required' });

  try {
    const firm = await Firm.findById(ownershipFirmId).select('name storageConfig').lean();
    const existingStorageConfig = decodeFirmStorageConfig(firm, ownershipFirmId);
    if (!existingStorageConfig?.refreshToken) {
      return res.status(404).json({ error: 'No active Google storage session found' });
    }

    const firmName = firm?.name || `Firm-${ownershipFirmId}`;
    const refreshToken = existingStorageConfig.refreshToken;

    const oauthClient = getStorageOAuthClient();
    oauthClient.setCredentials({ refresh_token: refreshToken });
    const provider = new GoogleDriveProvider({ oauthClient, driveId });

    const docketraFolderId = await provider.getOrCreateFolder(null, 'Docketra');
    const firmFolderId = await provider.getOrCreateFolder(docketraFolderId, firmName);

    await Firm.findByIdAndUpdate(ownershipFirmId, {
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

    return res.json({ success: true, status: 'ACTIVE_BYOS', rootFolderId: firmFolderId });
  } catch (error) {
    const mappedStatus = mapProviderErrorToStatus(error);
    return res.status(500).json({ error: 'confirm_drive_failed', status: mappedStatus });
  }
};

const getStorageConfiguration = async (req, res) => {
  try {
    const ownershipFirmId = await resolveOwnershipFirmIdForRead(req);
    if (!ownershipFirmId) return res.status(400).json({ error: 'Tenant mapping missing' });
    const firm = await Firm.findById(ownershipFirmId).select('storage storageConfig settings.storageBackup').lean();
    const state = resolveFirmStorageState(firm);

    let folderPath = null;
    if (state.rootFolderId) {
      try {
        const provider = await StorageProviderFactory.getProvider(ownershipFirmId);
        folderPath = await provider.getFolderPath(state.rootFolderId);
      } catch {
        folderPath = null;
      }
    }

    const backupSettings = firm?.settings?.storageBackup || {};
    res.set('Cache-Control', 'no-store');
    return res.json({
      provider: toUiProvider(state.canonicalProvider),
      isConfigured: Boolean(state.canonicalProvider),
      status: state.connectionStatus,
      connectedEmail: state.connectedEmail,
      warnings: state.isManaged ? ['Firm-owned BYOS is recommended but not required.'] : state.warnings,
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

const getStorageOwnershipSummary = async (req, res) => {
  if (!ensureFirmAdmin(req, res)) return;
  try {
    const ownershipFirmId = await resolveOwnershipFirmIdForWrite(req, res); if (!ownershipFirmId) return;
    const firm = await Firm.findById(ownershipFirmId).select('storage storageConfig settings.storageBackup').lean();
    const state = resolveFirmStorageState(firm);
    const storageProvider = toUiProvider(state.canonicalProvider);
    const storageMode = state.mode || MANAGED_STORAGE_MODE;
    const credentials = decodeFirmStorageConfig(firm, ownershipFirmId);
    const connectionStatus = state.connectionStatus;
    const lastHealthCheckAt = credentials?.lastCheckedAt || null;
    const lastHealthError = credentials?.lastError || null;

    let lastExport = null;
    try {
      const recent = await storageBackupService.listBackups(ownershipFirmId, 1);
      if (Array.isArray(recent) && recent.length > 0) {
        const item = recent[0];
        lastExport = {
          exportId: item?.exportId || null,
          createdAt: item?.createdAt || item?.timestamp || null,
          fileCount: Number(item?.fileCount || 0),
          size: Number(item?.size || 0),
          hasDownloadUrl: Boolean(item?.downloadUrl),
        };
      }
    } catch {
      lastExport = null;
    }

    const warnings = [];
    if (state.isManaged) {
      warnings.push({
        code: 'BYOS_NOT_CONFIGURED',
        message: 'BYOS is not configured. Docketra-managed fallback storage is active for firm operations.',
      });
    }
    if (connectionStatus === 'DISCONNECTED') {
      warnings.push({
        code: 'STORAGE_DISCONNECTED',
        message: 'Firm storage connection is currently disconnected.',
      });
    }
    if (lastHealthError) {
      warnings.push({
        code: 'HEALTH_CHECK_ERROR',
        message: 'Last provider health check reported an issue.',
      });
    }

    res.set('Cache-Control', 'no-store');
    return res.json({
      activeStorage: {
        provider: storageProvider,
        mode: storageMode,
        connectionStatus,
        connectedEmail: credentials?.connectedEmail || null,
      },
      lastHealthCheck: {
        checkedAt: lastHealthCheckAt,
        status: lastHealthError ? 'ERROR' : connectionStatus,
        lastError: lastHealthError,
      },
      fallbackStorage: {
        provider: 'docketra_managed',
        enabled: true,
        status: storageMode === MANAGED_STORAGE_MODE ? 'ACTIVE_MANAGED' : 'STANDBY',
      },
      backupExport: {
        backupEnabled: Boolean(firm?.settings?.storageBackup?.enabled),
        retentionDays: Number(firm?.settings?.storageBackup?.retentionDays || 30),
        lastExport,
      },
      ownershipModel:
        'Docketra uses a control-plane model. Firm and client data should remain in the configured storage provider according to your data ownership setup.',
      warnings,
    });
  } catch {
    return res.status(500).json({ error: 'storage_summary_fetch_failed' });
  }
};

const testStorageConnection = async (req, res) => {
  try {
    const ownershipFirmId = await resolveOwnershipFirmIdForWrite(req, res); if (!ownershipFirmId) return;
    const provider = await StorageProviderFactory.getProvider(ownershipFirmId);
    if (typeof provider.testConnection === 'function') {
      await provider.testConnection();
    }
    const status = provider?.providerName === 'docketra_managed' ? 'ACTIVE_MANAGED' : 'ACTIVE_BYOS';
    return res.json({ success: true, status, message: 'Storage connection is healthy.' });
  } catch {
    return res.status(502).json({ success: false, error: 'storage_connection_failed' });
  }
};

const changeFirmStorage = async (req, res) => {
  if (!ensureFirmAdmin(req, res)) return;
  if (!ensureStorageOtpVerification(req, res)) return;

  const ownershipFirmId = await resolveOwnershipFirmIdForWrite(req, res); if (!ownershipFirmId) return;
  const firmId = String(ownershipFirmId || '');
  const requestedProvider = String(req.body?.provider || '').trim();
  const provider = normalizeProvider(requestedProvider);
  const rawCredentials = req.body?.credentials || {};
  const backupSettings = req.body?.backupSettings || null;

  if (!provider || !SUPPORTED_STORAGE_PROVIDERS.has(provider)) {
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
    } else if (provider === 'google_drive') {
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
      const s3Credentials = rawCredentials.credentials || rawCredentials.awsCredentials || (
        rawCredentials.accessKeyId && rawCredentials.secretAccessKey
          ? {
              accessKeyId: rawCredentials.accessKeyId,
              secretAccessKey: rawCredentials.secretAccessKey,
              ...(rawCredentials.sessionToken ? { sessionToken: rawCredentials.sessionToken } : {}),
            }
          : undefined
      );
      adapter = new S3Provider({
        tenantId: String(firmId),
        bucket: rawCredentials.bucket,
        region: rawCredentials.region,
        prefix: rawCredentials.prefix,
        credentials: s3Credentials,
      });
      await adapter.testConnection();
    }

    const normalizedCredentials = provider === 'google_drive'
      ? {
          ...rawCredentials,
          refreshToken: rawCredentials?.googleRefreshToken || rawCredentials?.refreshToken || effectiveRefreshToken || null,
          googleRefreshToken: undefined,
        }
      : provider === 's3'
        ? {
            bucket: rawCredentials.bucket,
            region: rawCredentials.region,
            prefix: rawCredentials.prefix,
            credentials: rawCredentials.credentials || rawCredentials.awsCredentials || (
              rawCredentials.accessKeyId && rawCredentials.secretAccessKey
                ? {
                    accessKeyId: rawCredentials.accessKeyId,
                    secretAccessKey: rawCredentials.secretAccessKey,
                    ...(rawCredentials.sessionToken ? { sessionToken: rawCredentials.sessionToken } : {}),
                  }
                : undefined
            ),
          }
        : rawCredentials;

    const encryptedCredentials = provider === 'docketra_managed'
      ? null
      : encrypt(JSON.stringify(normalizedCredentials || {}));

    const canonicalProvider = provider;
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
    return res.status(400).json({
      success: false,
      message: isProduction() ? 'Unable to update storage provider' : (error.message || 'Unable to update storage provider'),
    });
  }
};

const exportFirmStorage = async (req, res) => {
  let ownershipFirmId = null;
  try {
    if (!ensurePrimaryAdmin(req, res)) return;
    ownershipFirmId = await resolveOwnershipFirmIdForWrite(req, res); if (!ownershipFirmId) return;
    const backup = await storageBackupService.runBackupForFirm(ownershipFirmId, { sendEmail: true });
    const access = await storageBackupService.buildBackupAccess({
      firmId: ownershipFirmId,
      exportId: backup.exportId,
    });
    const downloadUrl = access?.downloadUrl || null;
    if (downloadUrl) {
      try {
        await storageBackupService.emailBackupNotification({
          firmId: ownershipFirmId,
          exportId: backup.exportId,
          downloadUrl,
          success: true,
        });
      } catch (emailError) {
        log.error('[STORAGE]', { event: 'backup_email_failed', firmId: req.firmId, message: emailError.message });
      }
    }

    log.info('[STORAGE]', { event: 'backup_generated', firmId: ownershipFirmId, exportId: backup.exportId });
    await writeSettingsAudit({
      req,
      tenantId: getResolvedOwnershipAuditTenantId(ownershipFirmId, req),
      settingsKey: 'storage-export',
      action: 'EXPORT_GENERATED',
      metadata: {
        source: STORAGE_AUDIT_SOURCES.EXPORT_GENERATE,
        runtimeTenantId: req.firmId,
        exportId: backup.exportId,
        fileCount: backup.fileCount,
      },
      dedupeKey: `storage-export-generated:${backup.exportId}`,
    });
    logPilotEvent({
      event: 'storage_export_generated',
      metadata: { firmId: ownershipFirmId, exportId: backup.exportId, fileCount: backup.fileCount || 0 },
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
      metadata: { firmId: req.ownershipFirmId || req.firm?.ownershipFirmId || req.firmId, reasonCode: REASON_CODES.STORAGE_EXPORT_FAILED },
    });
    const auditTenantId = getResolvedOwnershipAuditTenantId(ownershipFirmId, req);
    if (auditTenantId) {
      try {
        await writeSettingsAudit({
          req,
          tenantId: auditTenantId,
          settingsKey: 'storage-export',
          action: 'EXPORT_FAILED',
          metadata: {
            source: STORAGE_AUDIT_SOURCES.EXPORT_GENERATE,
            runtimeTenantId: req.firmId,
            reasonCode: REASON_CODES.STORAGE_EXPORT_FAILED,
            message: error.message || null,
          },
        });
      } catch (auditError) {
        log.warn('[STORAGE]', {
          event: 'storage_export_failed_audit_write_failed',
          tenantId: auditTenantId,
          message: auditError.message,
        });
      }
    } else {
      log.warn('[STORAGE]', {
        event: 'storage_export_failed_audit_skipped_missing_ownership',
        runtimeTenantId: req.firmId,
      });
    }
    return res.status(500).json({
      error: 'export_failed',
      reasonCode: REASON_CODES.STORAGE_EXPORT_FAILED,
      ...(isProduction() ? {} : { message: error.message }),
    });
  }
};

const downloadFirmStorageExport = async (req, res) => {
  const { token } = req.params;
  const ownershipFirmId = await resolveOwnershipFirmIdForWrite(req, res); if (!ownershipFirmId) return;
  const entry = await storageBackupService.buildBackupAccess({ firmId: ownershipFirmId, exportId: token });
  if (!entry) return res.status(404).json({ error: 'invalid_or_expired_export_link' });

  if (!entry.downloadUrl) {
    logPilotEvent({
      event: 'storage_export_download_unavailable',
      severity: 'warn',
      metadata: { firmId: ownershipFirmId, exportId: token, reasonCode: REASON_CODES.EXPORT_DOWNLOAD_UNAVAILABLE },
    });
    return res.status(409).json({
      error: 'download_link_unavailable_for_provider',
      reasonCode: REASON_CODES.EXPORT_DOWNLOAD_UNAVAILABLE,
      message: 'Download link is unavailable for the active storage provider. Use backup run metadata and support recovery path.',
    });
  }
  await writeSettingsAudit({
    req,
    tenantId: ownershipFirmId,
    settingsKey: 'storage-export',
    action: 'EXPORT_DOWNLOAD_LINK_ISSUED',
    metadata: {
      source: STORAGE_AUDIT_SOURCES.EXPORT_DOWNLOAD,
      runtimeTenantId: req.firmId,
      exportId: token,
    },
    dedupeKey: `storage-export-download:${token}`,
  });
  return res.redirect(entry.downloadUrl);
};

const listBackupRuns = async (req, res) => {
  try {
    if (!ensurePrimaryAdmin(req, res)) return;
    const ownershipFirmId = await resolveOwnershipFirmIdForWrite(req, res); if (!ownershipFirmId) return;
    const items = await storageBackupService.listBackups(ownershipFirmId, req.query?.limit || 20);
    return res.json({
      success: true,
      data: items,
    });
  } catch (error) {
    logPilotEvent({
      event: 'storage_backup_runs_fetch_failed',
      severity: 'warn',
      metadata: { firmId: req.ownershipFirmId || req.firm?.ownershipFirmId || req.firmId, reasonCode: REASON_CODES.BACKUP_RUNS_FETCH_FAILED },
    });
    return res.status(500).json({
      error: 'backup_runs_fetch_failed',
      reasonCode: REASON_CODES.BACKUP_RUNS_FETCH_FAILED,
      ...(isProduction() ? {} : { message: error.message }),
    });
  }
};

const disconnectStorage = async (req, res) => {
  if (!ensurePrimaryAdmin(req, res)) return;
  try {
    const ownershipFirmId = await resolveOwnershipFirmIdForWrite(req, res); if (!ownershipFirmId) return;
    const previous = await Firm.findById(ownershipFirmId).select('storage storageConfig').lean();
    const previousProvider = normalizeProvider(previous?.storageConfig?.provider)
      || normalizeProvider(previous?.storage?.provider)
      || MANAGED_STORAGE_MODE;
    await Firm.findByIdAndUpdate(ownershipFirmId, {
      $set: {
        'storage.mode': MANAGED_STORAGE_MODE,
        'storage.provider': MANAGED_STORAGE_MODE,
        storageConfig: null,
      },
    });
    const next = await Firm.findById(ownershipFirmId).select('storage storageConfig').lean();
    await writeSettingsAudit({
      req,
      tenantId: getResolvedOwnershipAuditTenantId(ownershipFirmId, req),
      settingsKey: 'storage-config',
      action: 'CONFIG_CHANGED',
      oldDoc: {
        mode: previous?.storage?.mode || null,
        provider: previousProvider,
      },
      newDoc: {
        mode: next?.storage?.mode || null,
        provider: next?.storage?.provider || null,
      },
      metadata: { source: STORAGE_AUDIT_SOURCES.DISCONNECT, runtimeTenantId: req.firmId },
      dedupeKey: 'storage-disconnect',
    });
    return res.json({
      success: true,
      provider: toUiProvider(MANAGED_STORAGE_MODE),
      previousProvider: toUiProvider(previousProvider),
      action: 'SWITCHED_TO_MANAGED_FALLBACK',
      status: 'ACTIVE_MANAGED',
      connectionStatus: 'ACTIVE_MANAGED',
      rootFolderId: null,
    });
  } catch (error) {
    log.error('[STORAGE]', { event: 'disconnect_failed', tenantId: req.firmId, message: error.message });
    return res.status(500).json({ error: 'disconnect_failed', ...(isProduction() ? {} : { message: error.message }) });
  }
};

const storageHealthCheck = async (req, res) => {
  let ownershipFirmId = req.ownershipFirmId || req.firm?.ownershipFirmId || null;
  try {
    ownershipFirmId = ownershipFirmId || await resolveOwnershipFirmIdForWrite(req, res); if (!ownershipFirmId) return;
    const firm = await Firm.findById(ownershipFirmId).select('storage storageConfig').lean();
    const state = resolveFirmStorageState(firm);
    const provider = await StorageProviderFactory.getProvider(ownershipFirmId);
    if (supportsHealthCheck(provider)) await provider.testConnection();

    if (state.canonicalProvider === 'google_drive' && firm?.storageConfig?.credentials) {
      const credentials = decodeFirmStorageConfig(firm, ownershipFirmId);
      await Firm.findByIdAndUpdate(ownershipFirmId, {
        $set: {
          storageConfig: {
            provider: 'google_drive',
            credentials: encrypt(JSON.stringify({
              ...credentials,
              status: 'ACTIVE_BYOS',
              lastError: null,
              lastCheckedAt: new Date().toISOString(),
            })),
          },
        },
      });
    }
    const connectionStatus = state?.isManaged ? 'ACTIVE_MANAGED' : 'ACTIVE_BYOS';
    return res.json({ healthy: true, provider: toUiProvider(state.canonicalProvider), status: connectionStatus, connectionStatus });
  } catch (error) {
    if (ownershipFirmId) {
      const firm = await Firm.findById(ownershipFirmId).select('storage storageConfig').lean();
      const state = resolveFirmStorageState(firm);
      if (state.canonicalProvider === 'google_drive') {
        const mappedStatus = mapProviderErrorToStatus(error);
        if (mappedStatus === 'DISCONNECTED') {
          await googleDriveService.markStorageDisconnected(ownershipFirmId, error.message);
        } else {
          await googleDriveService.markStorageError(ownershipFirmId, error.message);
        }
      }
    }
    return res.status(502).json({ healthy: false, error: isProduction() ? 'health_check_failed' : (error.message || 'health_check_failed') });
  }
};

const storageUsage = async (req, res) => {
  try {
    const ownershipFirmId = await resolveOwnershipFirmIdForWrite(req, res); if (!ownershipFirmId) return;
    const firm = await Firm.findById(ownershipFirmId).select('storage storageConfig').lean();
    const state = resolveFirmStorageState(firm);
    const provider = await StorageProviderFactory.getProvider(ownershipFirmId);
    if (!supportsListFiles(provider)) {
      return res.status(400).json({
        error: 'usage_failed',
        code: 'STORAGE_PROVIDER_UNSUPPORTED_OPERATION',
        provider: toUiProvider(state.canonicalProvider),
        status: state.connectionStatus,
        connectionStatus: state.connectionStatus,
      });
    }
    const files = await provider.listFiles(null);
    const totalSizeBytes = files.reduce((acc, file) => acc + Number(file.size || 0), 0);
    return res.json({
      provider: toUiProvider(state.canonicalProvider),
      status: state.connectionStatus,
      connectionStatus: state.connectionStatus,
      totalFiles: files.length,
      totalSizeBytes,
    });
  } catch (error) {
    log.error('[STORAGE]', { event: 'usage_failed', tenantId: req.firmId, message: error.message });
    return res.status(500).json({ error: 'usage_failed', ...(isProduction() ? {} : { message: error.message }) });
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
  getStorageOwnershipSummary,
  __private: {
    resolveFirmSlugForRedirect,
    buildFrontendStorageRedirect,
  },
};
