const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { google } = require('googleapis');
const Firm = require('../models/Firm.model');
const StorageConfiguration = require('../models/StorageConfiguration.model');
const { getCookieValue } = require('../utils/requestCookies');
const { isAdminRole } = require('../utils/role.utils');
const { encrypt, decrypt } = require('../storage/services/TokenEncryption.service');
const GoogleDriveProvider = require('../services/storage/providers/GoogleDriveProvider');
const { StorageValidationError } = require('../storage/errors/StorageErrors');
const { StorageProviderFactory } = require('../services/storage/StorageProviderFactory');
const { S3Adapter } = require('../services/storageAdapter.service');

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
];
const STATE_COOKIE_NAME = 'storage_oauth_state';
const STATE_TTL_SECONDS = 10 * 60;
const MANAGED_STORAGE_MODE = 'docketra_managed';
const SUPPORTED_STORAGE_PROVIDERS = new Set(['docketra_managed', 'google-drive', 's3']);
const usedStorageOtpJti = new Map();

function ensureFirmAdmin(req, res) {
  if (!isAdminRole(req.user?.role)) {
    res.status(403).json({ error: 'Only firm admin can manage storage connection' });
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
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_OAUTH_REDIRECT_URI) {
    throw new Error('Google OAuth for storage is not fully configured');
  }
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI);
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
  if (error?.status === 403 && message.includes('quota')) return 'QUOTA_EXCEEDED';
  return 'ERROR';
}

const getStorageStatus = async (req, res) => {
  try {
    const record = await StorageConfiguration.findOne({ firmId: req.firmId, isActive: true }).select('provider -_id').lean();
    if (!record) return res.json({ connected: false, provider: null, status: null });

    return res.json({
      connected: true,
      provider: record.provider,
      status: 'ACTIVE',
    });
  } catch {
    return res.status(500).json({ error: 'Failed to retrieve storage status' });
  }
};

const getStorageHealth = async (req, res) => {
  try {
    const [activeConfig, firm] = await Promise.all([
      StorageConfiguration.findOne({ firmId: req.firmId, isActive: true }).select('_id').lean(),
      Firm.findById(req.firmId).select('storage -_id').lean(),
    ]);

    const storageMode = firm?.storage?.mode || MANAGED_STORAGE_MODE;
    const usingManagedStorage = storageMode === MANAGED_STORAGE_MODE;
    const defaultStatus = usingManagedStorage || activeConfig ? 'HEALTHY' : 'DISCONNECTED';
    const defaultLastError = usingManagedStorage || activeConfig ? null : 'Active storage configuration not found';

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
  if (!ensureFirmAdmin(req, res)) return;
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
  if (!ensureFirmAdmin(req, res)) return;
  try {
    const { code, state } = req.query;
    if (!code || !state) return res.status(400).json({ error: 'missing_params' });

    const cookieValue = getCookieValue(req.headers.cookie, STATE_COOKIE_NAME);
    const stateData = verifyStateToken(cookieValue, state);
    if (!stateData || stateData.tenantId !== req.firmId || stateData.provider !== 'google_drive') {
      return res.status(400).json({ error: 'invalid_state' });
    }

    const oauthClient = getStorageOAuthClient();
    const result = await oauthClient.getToken(code);
    const tokens = result.tokens || {};
    if (!tokens.refresh_token) return res.status(400).json({ error: 'no_refresh_token' });

    oauthClient.setCredentials({ refresh_token: tokens.refresh_token });
    const drive = google.drive({ version: 'v3', auth: oauthClient });
    const about = await drive.about.get({ fields: 'user(emailAddress)' });
    const drives = await drive.drives.list({ pageSize: 100, fields: 'drives(id,name)' });

    await StorageConfiguration.updateMany({ firmId: req.firmId, isActive: true }, { isActive: false });
    const config = await StorageConfiguration.findOne({ firmId: req.firmId, provider: 'google-drive' });
    const doc = config || new StorageConfiguration({ firmId: req.firmId, provider: 'google-drive' });
    doc.isActive = true;
    doc.credentials = {
      googleRefreshToken: encrypt(tokens.refresh_token),
      connectedEmail: about?.data?.user?.emailAddress || null,
    };
    await doc.save();

    res.setHeader('Set-Cookie', buildStateCookie('', 0));

    return res.json({
      success: true,
      provider: 'google-drive',
      drives: (drives.data.drives || []).map((d) => ({ id: d.id, name: d.name })),
    });
  } catch (error) {
    if (error instanceof StorageValidationError) {
      return res.status(400).json({ error: 'storage_configuration_invalid', message: error.message });
    }
    return res.status(500).json({ error: 'oauth_failed' });
  }
};

const googleConfirmDrive = async (req, res) => {
  if (!ensureFirmAdmin(req, res)) return;
  if (!ensureStorageOtpVerification(req, res)) return;
  const firmId = req.firmId;
  const { driveId } = req.body || {};
  if (!driveId) return res.status(400).json({ error: 'driveId is required' });

  try {
    const config = await StorageConfiguration.findOne({ firmId, isActive: true, provider: 'google-drive' });
    if (!config?.credentials?.googleRefreshToken) {
      return res.status(404).json({ error: 'No active Google storage session found' });
    }

    const refreshToken = decrypt(config.credentials.googleRefreshToken);
    const firm = await Firm.findById(firmId).select('name');
    const firmName = firm?.name || `Firm-${firmId}`;

    const oauthClient = getStorageOAuthClient();
    oauthClient.setCredentials({ refresh_token: refreshToken });
    const provider = new GoogleDriveProvider({ oauthClient, driveId });

    const docketraFolderId = await provider.getOrCreateFolder(null, 'Docketra');
    const firmFolderId = await provider.getOrCreateFolder(docketraFolderId, firmName);

    config.driveId = driveId;
    config.rootFolderId = firmFolderId;
    await config.save();

    return res.json({ success: true, status: 'ACTIVE', rootFolderId: firmFolderId });
  } catch (error) {
    const mappedStatus = mapProviderErrorToStatus(error);
    return res.status(500).json({ error: 'confirm_drive_failed', status: mappedStatus });
  }
};

const getStorageConfiguration = async (req, res) => {
  try {
    const firmId = req.firmId;
    const config = await StorageConfiguration.findOne({ firmId, isActive: true }).select('provider rootFolderId credentials.connectedEmail updatedAt createdAt').lean();

    if (!config) {
      return res.json({ provider: 'docketra_managed', isConfigured: true, status: 'ACTIVE' });
    }

    let folderPath = null;
    if (config.rootFolderId) {
      try {
        const provider = await StorageProviderFactory.getProvider(firmId);
        folderPath = await provider.getFolderPath(config.rootFolderId);
      } catch {
        folderPath = null;
      }
    }

    return res.json({
      provider: config.provider,
      isConfigured: true,
      status: 'ACTIVE',
      connectedEmail: config.credentials?.connectedEmail || null,
      rootFolderId: config.rootFolderId || null,
      folderPath,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
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

  if (!SUPPORTED_STORAGE_PROVIDERS.has(provider)) {
    return res.status(400).json({ success: false, message: 'Unsupported storage provider' });
  }

  try {
    let adapter = null;
    if (provider === 'docketra_managed') {
      adapter = { providerName: 'docketra_managed' };
    } else if (provider === 'google-drive') {
      if (!rawCredentials?.googleRefreshToken) {
        return res.status(400).json({ success: false, message: 'googleRefreshToken is required for Google Drive' });
      }
      const oauthClient = getStorageOAuthClient();
      oauthClient.setCredentials({ refresh_token: rawCredentials.googleRefreshToken });
      adapter = new GoogleDriveProvider({ oauthClient, driveId: rawCredentials.driveId || null });
      if (typeof adapter.testConnection === 'function') {
        await adapter.testConnection();
      }
    } else if (provider === 's3') {
      adapter = new S3Adapter(rawCredentials);
      await adapter.testConnection();
    }

    await StorageConfiguration.updateMany({ firmId, isActive: true }, { isActive: false });
    const encryptedCredentials = provider === 'docketra_managed'
      ? null
      : encrypt(JSON.stringify(rawCredentials || {}));
    await StorageConfiguration.create({
      firmId,
      provider,
      credentials: encryptedCredentials ? { encryptedPayload: encryptedCredentials } : null,
      isActive: true,
    });

    await Firm.findByIdAndUpdate(firmId, {
      $set: {
        'storage.mode': provider === 'docketra_managed' ? 'docketra_managed' : 'firm_connected',
        'storage.provider': provider === 'google-drive' ? 'google_drive' : provider,
      },
    });

    return res.json({ success: true, data: { provider, isActive: true, tested: Boolean(adapter) } });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Unable to update storage provider' });
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
  changeFirmStorage,
  buildStateCookie,
  mapProviderErrorToStatus,
};
