const crypto = require('crypto');
const { google } = require('googleapis');
const TenantStorageConfig = require('../models/TenantStorageConfig.model');
const Firm = require('../models/Firm.model');
const { encrypt, decrypt } = require('../storage/services/TokenEncryption.service');
const GoogleDriveProvider = require('../storage/providers/GoogleDriveProvider');
const OneDriveProvider = require('../storage/providers/OneDriveProvider');

const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/drive';
const ONEDRIVE_SCOPES = ['Files.ReadWrite.All', 'Sites.ReadWrite.All', 'offline_access'];
const STATE_COOKIE_NAME = 'storage_oauth_state';
const STATE_TTL_SECONDS = 10 * 60;

function ensureFirmAdmin(req, res) {
  if (req.user?.role !== 'ADMIN') {
    res.status(403).json({ error: 'Only firm admin can manage storage connection' });
    return false;
  }
  return true;
}

function getStorageOAuthClient() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_OAUTH_REDIRECT_URI) {
    throw new Error('Google OAuth for storage is not fully configured');
  }
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI);
}

function getOneDriveOAuthConfig() {
  const {
    ONEDRIVE_CLIENT_ID,
    ONEDRIVE_CLIENT_SECRET,
    ONEDRIVE_REDIRECT_URI,
    ONEDRIVE_TENANT_ID = 'common',
  } = process.env;
  if (!ONEDRIVE_CLIENT_ID || !ONEDRIVE_CLIENT_SECRET || !ONEDRIVE_REDIRECT_URI) {
    throw new Error('OneDrive OAuth for storage is not fully configured');
  }
  return { ONEDRIVE_CLIENT_ID, ONEDRIVE_CLIENT_SECRET, ONEDRIVE_REDIRECT_URI, ONEDRIVE_TENANT_ID };
}

function buildStateToken(tenantId, provider) {
  const nonce = crypto.randomBytes(16).toString('hex');
  const payload = Buffer.from(JSON.stringify({ tenantId, provider, nonce })).toString('base64url');
  const sig = crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(payload)
    .digest('hex');
  return `${payload}.${sig}`;
}

function verifyStateToken(cookieValue, stateParam) {
  if (!cookieValue || !stateParam || cookieValue !== stateParam) {
    return null;
  }
  const dotIdx = cookieValue.lastIndexOf('.');
  if (dotIdx === -1) return null;

  const payload = cookieValue.slice(0, dotIdx);
  const sig = cookieValue.slice(dotIdx + 1);

  const expectedSig = crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(payload)
    .digest('hex');

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

function parseCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const pair = cookieHeader
    .split(';')
    .map(c => c.trim())
    .find(c => c.startsWith(`${name}=`));
  return pair ? pair.slice(name.length + 1) : null;
}

function buildStateCookie(value, maxAge) {
  const parts = [
    `${STATE_COOKIE_NAME}=${value}`,
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
    'Path=/',
  ];
  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }
  return parts.join('; ');
}

function mapProviderErrorToStatus(error) {
  const message = (error?.message || '').toLowerCase();
  if (error?.status === 401 || message.includes('invalid_grant') || message.includes('token')) {
    return 'DISCONNECTED';
  }
  if (error?.status === 404 || message.includes('root') || message.includes('not found')) {
    return 'DEGRADED';
  }
  if (error?.status === 403 && message.includes('quota')) {
    return 'QUOTA_EXCEEDED';
  }
  return 'ERROR';
}

const getStorageStatus = async (req, res) => {
  const tenantId = req.firmId;
  try {
    const record = await TenantStorageConfig.findOne({ tenantId, isActive: true })
      .select('provider status isActive -_id');

    if (!record) {
      return res.json({ connected: false, provider: null, status: null });
    }

    return res.json({
      connected: record.status === 'ACTIVE' && record.isActive === true,
      provider: record.provider,
      status: record.status,
    });
  } catch (err) {
    console.error('[Storage] Failed to query TenantStorageConfig:', { tenantId, message: err.message });
    return res.status(500).json({ error: 'Failed to retrieve storage status' });
  }
};

const googleConnect = (req, res) => {
  if (!ensureFirmAdmin(req, res)) return;
  try {
    const oauthClient = getStorageOAuthClient();
    const stateToken = buildStateToken(req.firmId, 'google_drive');

    const authUrl = oauthClient.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [GOOGLE_SCOPE],
      state: stateToken,
    });

    res.setHeader('Set-Cookie', buildStateCookie(stateToken, STATE_TTL_SECONDS));
    return res.redirect(authUrl);
  } catch (err) {
    console.error('[Storage][GoogleConnect] Configuration error:', err.message);
    return res.status(503).json({ error: 'Google OAuth for storage is not configured' });
  }
};

const googleCallback = async (req, res) => {
  if (!ensureFirmAdmin(req, res)) return;
  try {
    const { code, state } = req.query;
    if (!code || !state) {
      return res.status(400).json({ error: 'missing_params' });
    }

    const cookieValue = parseCookie(req.headers.cookie || '', STATE_COOKIE_NAME);
    const stateData = verifyStateToken(cookieValue, state);
    if (!stateData || stateData.tenantId !== req.firmId || stateData.provider !== 'google_drive') {
      return res.status(400).json({ error: 'invalid_state' });
    }

    const oauthClient = getStorageOAuthClient();
    const result = await oauthClient.getToken(code);
    const tokens = result.tokens || {};

    if (!tokens.refresh_token) {
      return res.status(400).json({ error: 'no_refresh_token' });
    }

    oauthClient.setCredentials({ refresh_token: tokens.refresh_token });
    const drive = google.drive({ version: 'v3', auth: oauthClient });
    const drives = await drive.drives.list({ pageSize: 100, fields: 'drives(id,name)' });

    await TenantStorageConfig.findOneAndUpdate(
      { tenantId: req.firmId, provider: 'google_drive', isActive: false },
      {
        tenantId: req.firmId,
        provider: 'google_drive',
        encryptedRefreshToken: encrypt(tokens.refresh_token),
        connectedByUserId: req.user?._id?.toString() || req.user?.xID || 'system',
        status: 'DISCONNECTED',
        isActive: false,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.setHeader('Set-Cookie', buildStateCookie('', 0));

    return res.json({
      success: true,
      provider: 'google_drive',
      drives: (drives.data.drives || []).map((d) => ({ id: d.id, name: d.name })),
    });
  } catch (error) {
    console.error('[Storage][GoogleCallback] OAuth callback failed', { message: error.message });
    return res.status(500).json({ error: 'oauth_failed' });
  }
};

const onedriveConnect = (req, res) => {
  if (!ensureFirmAdmin(req, res)) return;
  try {
    const { ONEDRIVE_CLIENT_ID, ONEDRIVE_REDIRECT_URI, ONEDRIVE_TENANT_ID } = getOneDriveOAuthConfig();
    const stateToken = buildStateToken(req.firmId, 'onedrive');
    const params = new URLSearchParams({
      client_id: ONEDRIVE_CLIENT_ID,
      response_type: 'code',
      redirect_uri: ONEDRIVE_REDIRECT_URI,
      response_mode: 'query',
      scope: ONEDRIVE_SCOPES.join(' '),
      state: stateToken,
    });
    res.setHeader('Set-Cookie', buildStateCookie(stateToken, STATE_TTL_SECONDS));
    return res.redirect(`https://login.microsoftonline.com/${ONEDRIVE_TENANT_ID}/oauth2/v2.0/authorize?${params.toString()}`);
  } catch (error) {
    console.error('[Storage][OneDriveConnect] Configuration error:', error.message);
    return res.status(503).json({ error: 'OneDrive OAuth for storage is not configured' });
  }
};

const onedriveCallback = async (req, res) => {
  if (!ensureFirmAdmin(req, res)) return;
  try {
    const { code, state } = req.query;
    if (!code || !state) {
      return res.status(400).json({ error: 'missing_params' });
    }

    const cookieValue = parseCookie(req.headers.cookie || '', STATE_COOKIE_NAME);
    const stateData = verifyStateToken(cookieValue, state);
    if (!stateData || stateData.tenantId !== req.firmId || stateData.provider !== 'onedrive') {
      return res.status(400).json({ error: 'invalid_state' });
    }

    const { ONEDRIVE_CLIENT_ID, ONEDRIVE_CLIENT_SECRET, ONEDRIVE_REDIRECT_URI, ONEDRIVE_TENANT_ID } = getOneDriveOAuthConfig();

    const tokenRes = await fetch(`https://login.microsoftonline.com/${ONEDRIVE_TENANT_ID}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: ONEDRIVE_CLIENT_ID,
        client_secret: ONEDRIVE_CLIENT_SECRET,
        code,
        redirect_uri: ONEDRIVE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      return res.status(400).json({ error: 'token_exchange_failed' });
    }

    const tokenData = await tokenRes.json();
    if (!tokenData.refresh_token) {
      return res.status(400).json({ error: 'no_refresh_token' });
    }

    const drivesRes = await fetch('https://graph.microsoft.com/v1.0/me/drives', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!drivesRes.ok) {
      return res.status(400).json({ error: 'drive_list_failed' });
    }

    const drivesData = await drivesRes.json();

    await TenantStorageConfig.findOneAndUpdate(
      { tenantId: req.firmId, provider: 'onedrive', isActive: false },
      {
        tenantId: req.firmId,
        provider: 'onedrive',
        encryptedRefreshToken: encrypt(tokenData.refresh_token),
        connectedByUserId: req.user?._id?.toString() || req.user?.xID || 'system',
        status: 'DISCONNECTED',
        isActive: false,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.setHeader('Set-Cookie', buildStateCookie('', 0));

    return res.json({
      success: true,
      provider: 'onedrive',
      drives: (drivesData.value || []).map((d) => ({ id: d.id, name: d.name })),
    });
  } catch (error) {
    console.error('[Storage][OneDriveCallback] OAuth callback failed', { message: error.message });
    return res.status(500).json({ error: 'oauth_failed' });
  }
};

async function confirmDrive(req, res, providerName) {
  if (!ensureFirmAdmin(req, res)) return;
  const tenantId = req.firmId;
  const { driveId } = req.body || {};

  if (!driveId) {
    return res.status(400).json({ error: 'driveId is required' });
  }

  const pending = await TenantStorageConfig.findOne({ tenantId, provider: providerName, isActive: false }).sort({ updatedAt: -1 });
  if (!pending) {
    return res.status(404).json({ error: 'No pending storage OAuth session found' });
  }

  try {
    const refreshToken = decrypt(pending.encryptedRefreshToken);
    const firm = await Firm.findById(tenantId).select('name');
    const tenantName = firm?.name || 'Tenant';

    let provider;
    if (providerName === 'google_drive') {
      const oauthClient = getStorageOAuthClient();
      oauthClient.setCredentials({ refresh_token: refreshToken });
      provider = new GoogleDriveProvider({ oauthClient, driveId });
    } else {
      provider = new OneDriveProvider({ refreshToken, driveId });
    }

    const { folderId: docketraFolderId } = await provider.createFolder('Docketra');
    const { folderId: rootFolderId } = await provider.createFolder(tenantName, docketraFolderId);

    await TenantStorageConfig.updateMany({ tenantId, isActive: true }, { isActive: false, status: 'DISCONNECTED' });

    await TenantStorageConfig.findByIdAndUpdate(pending._id, {
      driveId,
      rootFolderId,
      connectedByUserId: req.user?._id?.toString() || req.user?.xID || 'system',
      status: 'ACTIVE',
      isActive: true,
    });

    return res.json({ success: true, status: 'ACTIVE' });
  } catch (error) {
    const mappedStatus = mapProviderErrorToStatus(error);
    await TenantStorageConfig.findByIdAndUpdate(pending._id, { status: mappedStatus, isActive: false });
    console.error('[Storage][ConfirmDrive] Failed to confirm drive', { tenantId, provider: providerName, message: error.message });
    return res.status(500).json({ error: 'confirm_drive_failed', status: mappedStatus });
  }
}

const googleConfirmDrive = (req, res) => confirmDrive(req, res, 'google_drive');
const onedriveConfirmDrive = (req, res) => confirmDrive(req, res, 'onedrive');

module.exports = {
  getStorageStatus,
  googleConnect,
  googleCallback,
  googleConfirmDrive,
  onedriveConnect,
  onedriveCallback,
  onedriveConfirmDrive,
  buildStateCookie,
  mapProviderErrorToStatus,
};
