const crypto = require('crypto');
const FirmStorage = require('../models/FirmStorage.model');
const { encrypt } = require('../storage/services/TokenEncryption.service');
const { enqueueStorageJob } = require('../queues/storage.queue');
const { google } = require('googleapis');

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
 * Build a Set-Cookie header value for the state cookie.
 * @param {string} value   - cookie value (empty string to clear)
 * @param {number} maxAge  - Max-Age in seconds (0 to delete)
 */
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

    res.setHeader('Set-Cookie', buildStateCookie(stateToken, STATE_TTL_SECONDS));
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
 * creates the /Docketra root folder in the firm's Drive via the storage
 * provider abstraction, and persists an encrypted FirmStorage record.
 * Redirects to the frontend on both success and failure.
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

    // Require a refresh token — without it we cannot refresh access later
    if (!tokens.refresh_token) {
      console.warn('[Storage][GoogleCallback] No refresh_token in response', { firmId: req.firmId });
      return res.redirect(`${errorUrl}&reason=no_refresh_token`);
    }

    // Encrypt tokens before persisting — raw tokens must never be stored.
    // At this point tokens.refresh_token is guaranteed present (checked above at the
    // no_refresh_token guard); encrypting directly is safe.
    const encryptedAccessToken = encrypt(tokens.access_token);
    const encryptedRefreshToken = encrypt(tokens.refresh_token);
    const tokenExpiry = tokens.expiry_date ? new Date(tokens.expiry_date) : undefined;

    // Upsert FirmStorage record with pending status — root folder creation
    // happens asynchronously via the storage worker.
    await FirmStorage.findOneAndUpdate(
      { firmId: req.firmId },
      {
        firmId: req.firmId,
        provider: 'google',
        encryptedAccessToken,
        encryptedRefreshToken,
        ...(tokenExpiry !== undefined && { tokenExpiry }),
        status: 'pending',
      },
      { upsert: true, new: true }
    );

    // Enqueue root folder creation — do not block the request
    try {
      await enqueueStorageJob('CREATE_ROOT_FOLDER', {
        firmId: req.firmId,
        provider: 'google',
      });
    } catch (queueErr) {
      // If enqueueing fails, mark storage as errored so the UI can surface the issue
      console.error('[Storage][GoogleCallback] Failed to enqueue root folder job:', queueErr.message);
      await FirmStorage.findOneAndUpdate({ firmId: req.firmId }, { status: 'error' }).catch(() => {});
      return res.redirect(`${errorUrl}&reason=queue_unavailable`);
    }

    // Clear the state cookie with the same flags used when setting it
    res.setHeader('Set-Cookie', buildStateCookie('', 0));

    console.info('[Storage][GoogleCallback] Drive connection saved, root folder creation enqueued', { firmId: req.firmId });
    return res.redirect(successUrl);
  } catch (err) {
    console.error('[Storage][GoogleCallback] Unexpected error:', err.message);
    return res.redirect(errorUrl);
  }
};

module.exports = { getStorageStatus, googleConnect, googleCallback, buildStateCookie };
