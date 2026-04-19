const crypto = require('crypto');
const { google } = require('googleapis');

const getGoogleAuthRedirectUri = (env = {}) => (
  env.GOOGLE_AUTH_REDIRECT_URI
  || env.GOOGLE_CALLBACK_URL
  || env.GOOGLE_OAUTH_REDIRECT_URI
  || process.env.GOOGLE_AUTH_REDIRECT_URI
  || process.env.GOOGLE_CALLBACK_URL
  || process.env.GOOGLE_OAUTH_REDIRECT_URI
  || null
);

const getGoogleOAuthClient = (env = {}) => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new Error('GOOGLE_OAUTH_CONFIG_MISSING');
  }

  const googleAuthRedirectUri = getGoogleAuthRedirectUri(env);
  if (!googleAuthRedirectUri) {
    throw new Error('GOOGLE_AUTH_REDIRECT_URI_MISSING');
  }

  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    googleAuthRedirectUri
  );
};

const signGoogleState = (payload) => {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', process.env.JWT_SECRET || 'docketra-google-auth')
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${signature}`;
};

const parseGoogleState = (rawState) => {
  if (!rawState || typeof rawState !== 'string' || !rawState.includes('.')) {
    return null;
  }

  const [encodedPayload, providedSig] = rawState.split('.');
  if (!encodedPayload || !providedSig) {
    return null;
  }

  const expectedSig = crypto
    .createHmac('sha256', process.env.JWT_SECRET || 'docketra-google-auth')
    .update(encodedPayload)
    .digest('base64url');

  if (providedSig !== expectedSig) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch (_error) {
    return null;
  }
};

module.exports = {
  getGoogleAuthRedirectUri,
  getGoogleOAuthClient,
  signGoogleState,
  parseGoogleState,
};
