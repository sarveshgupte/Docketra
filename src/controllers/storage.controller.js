const crypto = require('crypto');
const { google } = require('googleapis');
const FirmStorage = require('../models/FirmStorage.model');
const { encrypt } = require('../storage/services/TokenEncryption.service');

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const STATE_COOKIE_NAME = 'storage_oauth_state';
const STATE_TTL_SECONDS = 10 * 60; // 10 minutes

/**
 * Returns a configured Google OAuth2 client for BYOS storage flows.
 * Uses GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_OAUTH_REDIRECT_URI.
 */
function getStorageOAuthClient() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_OAUTH_REDIRECT_URI) {
    throw new Error('Google OAuth for storage is not fully configured');
  }
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI);
}

/**
 * Build a signed state token: base64url(JSON) + '.' + HMAC-SHA256 hex.
 * Signed with JWT_SECRET — consistent with how the existing Google auth flow
 * (auth.controller.js createOAuthState) signs its state tokens.
 */
function buildStateToken(firmId) {
  const nonce = crypto.randomBytes(16).toString('hex');
  const payload = Buffer.from(JSON.stringify({ firmId, nonce })).toString('base64url');
  const sig = crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(payload)
    .digest('hex');
  return `${payload}.${sig}`;
}

/**
 * Verify a state token returned by Google matches the one stored in the cookie.
 * Returns the decoded payload or null on any failure.
 *
 * @param {string|null} cookieValue  - value from the storage_oauth_state cookie
 * @param {string|null} stateParam   - state query parameter from Google
 * @returns {{ firmId: string, nonce: string }|null}
 */
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

  // Constant-time comparison to prevent timing attacks
  let sigBuffer, expectedBuffer;
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

/**
 * Parse a single cookie by name from the Cookie header string.
 */
function parseCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const pair = cookieHeader
    .split(';')
    .map(c => c.trim())
    .find(c => c.startsWith(`${name}=`));
  return pair ? pair.slice(name.length + 1) : null;
}

/**
 * GET /api/storage/status
 *
 * Returns the BYOS storage connection state for the requesting firm.
 * Raw tokens are never included in the response.
 */
const getStorageStatus = async (req, res) => {
  const firmId = req.firmId;

  try {
    const record = await FirmStorage.findOne({ firmId }).select(
      'provider status -_id'
    );

    if (!record) {
      return res.json({ connected: false, provider: null, status: null });
    }

    return res.json({
      // TODO (future PR): also validate tokenExpiry and rootFolderId presence
      // before marking a provider as truly "connected".
      connected: record.status === 'active',
      provider: record.provider,
      status: record.status,
    });
  } catch (err) {
    console.error('[Storage] Failed to query FirmStorage:', { firmId, message: err.message });
    return res.status(500).json({ error: 'Failed to retrieve storage status' });
  }
};

/**
 * GET /api/storage/google/connect
 *
 * Generates a Google OAuth consent URL for the drive.file scope and redirects
 * the firm admin to it.  A signed, short-lived HTTP-only cookie carries the
 * CSRF state so the callback can verify it.
 */
const googleConnect = (req, res) => {
  try {
    const oauthClient = getStorageOAuthClient();
    const stateToken = buildStateToken(req.firmId);

    const authUrl = oauthClient.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [DRIVE_SCOPE],
      state: stateToken,
    });

    const cookieParts = [
      `${STATE_COOKIE_NAME}=${stateToken}`,
      'HttpOnly',
      'SameSite=Lax',
      `Max-Age=${STATE_TTL_SECONDS}`,
      'Path=/',
    ];
    if (process.env.NODE_ENV === 'production') {
      cookieParts.push('Secure');
    }
    res.setHeader('Set-Cookie', cookieParts.join('; '));

    return res.redirect(authUrl);
  } catch (err) {
    console.error('[Storage][GoogleConnect] Configuration error:', err.message);
    return res.status(503).json({ error: 'Google OAuth for storage is not configured' });
  }
};

/**
 * GET /api/storage/google/callback
 *
 * Receives the authorization code from Google, exchanges it for tokens,
 * creates the /Docketra root folder in the firm's Drive, and persists an
 * encrypted FirmStorage record.  Redirects to the frontend on both success
 * and failure.
 */
const googleCallback = async (req, res) => {
  const frontendUrl = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
  const successUrl = `${frontendUrl}/settings/storage?connected=true`;
  const errorUrl = `${frontendUrl}/settings/storage?error=oauth_failed`;

  try {
    const { code, state } = req.query;
    if (!code || !state) {
      return res.redirect(`${errorUrl}&reason=missing_params`);
    }

    // Verify the CSRF state cookie
    const cookieValue = parseCookie(req.headers.cookie || '', STATE_COOKIE_NAME);
    const stateData = verifyStateToken(cookieValue, state);
    if (!stateData) {
      console.warn('[Storage][GoogleCallback] State verification failed', { firmId: req.firmId });
      return res.redirect(`${errorUrl}&reason=invalid_state`);
    }

    // Ensure the cookie was issued for this firm
    if (stateData.firmId !== req.firmId) {
      console.error('[Storage][GoogleCallback] firmId mismatch', {
        cookieFirmId: stateData.firmId,
        reqFirmId: req.firmId,
      });
      return res.redirect(`${errorUrl}&reason=firm_mismatch`);
    }

    // Exchange authorization code for tokens
    const oauthClient = getStorageOAuthClient();
    let tokens;
    try {
      const result = await oauthClient.getToken(code);
      tokens = result.tokens;
    } catch (tokenErr) {
      console.error('[Storage][GoogleCallback] Token exchange failed:', tokenErr.message);
      return res.redirect(`${errorUrl}&reason=token_exchange_failed`);
    }

    if (!tokens || !tokens.access_token) {
      return res.redirect(`${errorUrl}&reason=no_access_token`);
    }

    // Create /Docketra root folder in the firm's Drive using the new tokens
    oauthClient.setCredentials(tokens);
    const drive = google.drive({ version: 'v3', auth: oauthClient });

    let rootFolderId;
    try {
      const folderRes = await drive.files.create({
        requestBody: {
          name: 'Docketra',
          mimeType: 'application/vnd.google-apps.folder',
        },
        fields: 'id',
      });
      rootFolderId = folderRes.data.id;
    } catch (folderErr) {
      console.error('[Storage][GoogleCallback] Root folder creation failed:', folderErr.message);
      return res.redirect(`${errorUrl}&reason=folder_creation_failed`);
    }

    // Encrypt tokens before persisting — raw tokens must never be stored
    const encryptedAccessToken = encrypt(tokens.access_token);
    const encryptedRefreshToken = tokens.refresh_token
      ? encrypt(tokens.refresh_token)
      : undefined;
    const tokenExpiry = tokens.expiry_date ? new Date(tokens.expiry_date) : undefined;

    // Upsert FirmStorage record (one record per firm, idempotent)
    await FirmStorage.findOneAndUpdate(
      { firmId: req.firmId },
      {
        firmId: req.firmId,
        provider: 'google',
        encryptedAccessToken,
        ...(encryptedRefreshToken !== undefined && { encryptedRefreshToken }),
        ...(tokenExpiry !== undefined && { tokenExpiry }),
        rootFolderId,
        status: 'active',
      },
      { upsert: true, new: true }
    );

    // Clear the state cookie
    res.setHeader(
      'Set-Cookie',
      `${STATE_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/`
    );

    console.info('[Storage][GoogleCallback] Drive connected successfully', { firmId: req.firmId });
    return res.redirect(successUrl);
  } catch (err) {
    console.error('[Storage][GoogleCallback] Unexpected error:', err.message);
    return res.redirect(errorUrl);
  }
};

module.exports = { getStorageStatus, googleConnect, googleCallback };
