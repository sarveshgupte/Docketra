const assert = require('assert');
const createAuthLoginService = require('../src/services/authLogin.service');
const createAuthPasswordService = require('../src/services/authPassword.service');

function createRes() {
  const state = { statusCode: 200, body: null };
  return {
    state,
    status(code) { state.statusCode = code; return this; },
    json(payload) { state.body = payload; return payload; },
    setHeader() {},
  };
}

async function tenantOtpSmoke() {
  const user = {
    _id: 'u-1', firmId: 'firm-1', xID: 'X123456', status: 'active', isActive: true,
    email: 'pilot@firm.test', loginOtpHash: 'hash:123456', loginOtpExpiresAt: new Date(Date.now() + 30_000), loginOtpAttempts: 0,
  };
  const loginSession = { _id: 'ls-1', userId: 'u-1', firmId: 'firm-1', expiresAt: new Date(Date.now() + 30_000), consumedAt: null };
  let cookiesSet = 0;
  const service = createAuthLoginService({
    models: {
      User: { findOne: async (query) => (query.xID === 'X123456' || query._id === 'u-1' ? user : null) },
      LoginSession: { findOne: async () => loginSession, updateOne: async () => ({}) },
    },
    utils: {
      getSuperadminEnv: () => ({ normalizedXID: null }), handleSuperadminLogin: async () => {}, validateTenantUserPreconditions: async () => false,
      handlePasswordVerification: async () => true, handlePostPasswordChecks: async () => false, sendLoginOtpChallenge: async () => 'login-token',
      getLoginOtpConfig: () => ({ maxAttempts: 5, lockMinutes: 1 }), LOGIN_OTP_COOLDOWN_SECONDS: 0, hashLoginSessionToken: () => 'hash-token',
      clearExpiredLoginOtpLock: async () => {}, getLoginOtpLockSeconds: () => 0, logLoginOtpEvent: () => {}, clearLoginOtpState: () => {},
      persistLoginOtpState: async () => {}, logAuthAudit: async () => {}, DEFAULT_XID: 'X123456', DEFAULT_FIRM_ID: 'firm-1', noteLoginFailure: async () => {},
      clearCachedLoginOtpState: async () => {}, normalizeFirmSlug: (v) => v,
      buildSuccessfulLoginPayload: async () => ({ success: true, accessToken: 'access', refreshToken: 'refresh', data: { xid: 'X123456' } }),
      setAuthCookies: () => { cookiesSet += 1; },
    },
    services: { authOtpService: { verifyOtp: async (otp, hash) => hash === `hash:${otp}` } },
  });

  const initRes = createRes();
  await service.login({ body: { xID: 'X123456', password: 'Strong#123' }, firmId: 'firm-1', firmSlug: 'pilot' }, initRes);
  assert.strictEqual(initRes.state.statusCode, 200);

  const verifyRes = createRes();
  await service.verifyLoginOtp({ body: { otp: '123456', loginToken: 'any' }, firmId: 'firm-1', firmSlug: 'pilot' }, verifyRes);
  assert.strictEqual(verifyRes.state.statusCode, 200);
  assert.strictEqual(cookiesSet, 1);

  const badRes = createRes();
  await service.verifyLoginOtp({ body: { otp: '000000', loginToken: 'any' }, firmId: 'firm-1', firmSlug: 'pilot' }, badRes);
  assert.strictEqual(badRes.state.statusCode, 401);
}

async function forgotPasswordSmoke() {
  const user = { _id: 'u-1', email: 'pilot@firm.test', xID: 'X123456', firmId: 'firm-1', status: 'active', isActive: true, forgotPasswordOtpAttempts: 0, save: async function(){return this;} };
  const service = createAuthPasswordService({
    normalizeFirmSlug: (v) => v, SALT_ROUNDS: 10, DEFAULT_XID: 'X123456', DEFAULT_FIRM_ID: 'firm-1', PASSWORD_POLICY_MESSAGE: 'weak', validatePasswordStrength: () => true,
    Firm: { findOne: () => ({ select: () => ({ lean: async () => ({ _id: 'firm-1', firmSlug: 'pilot', status: 'active' }) }) }), findById: () => ({ select: () => ({ lean: async () => ({ _id: 'firm-1', firmSlug: 'pilot', status: 'active' }) }) }) },
    User: { findOne: async (q) => (q.firmId === 'firm-1' ? user : null), find: () => ({ limit: async () => [user] }) },
    emailService: { sendLoginOtpEmail: async () => {}, generateSecureToken: () => 'legacy', hashToken: (v) => `h:${v}`, sendForgotPasswordEmail: async () => ({}), maskEmail: (v) => v },
    isActiveStatus: (s) => s === 'active', FORGOT_PASSWORD_TOKEN_EXPIRY_MINUTES: 30, logAuthAudit: async () => {}, FORGOT_PASSWORD_OTP_RESEND_COOLDOWN_SECONDS: 0,
    FORGOT_PASSWORD_OTP_EXPIRY_MINUTES: 10, FORGOT_PASSWORD_OTP_LOCK_MINUTES: 10,
    authOtpService: { generateOtp: () => '123456', hashOtp: async () => 'hash:123456', verifyOtp: async (otp) => otp === '123456', incrementAttempts: (a, m) => ({ attempts: a + 1, exhausted: a + 1 >= m }) },
    clearForgotPasswordOtpState: () => {}, generateLoginSessionToken: () => 'reset-1', hashLoginSessionToken: () => 'h:reset-1', bcrypt: { hash: async () => 'pw' },
  });

  const initRes = createRes();
  await service.forgotPasswordInit({ body: { identifier: 'X123456', firmSlug: 'pilot' }, ip: '127.0.0.1', get: () => 'test-agent' }, initRes);
  assert.strictEqual(initRes.state.statusCode, 200);

  const verifyRes = createRes();
  await service.forgotPasswordVerify({ body: { identifier: 'X123456', firmSlug: 'pilot', otp: '123456' }, ip: '127.0.0.1', get: () => 'test-agent' }, verifyRes);
  assert.strictEqual(verifyRes.state.statusCode, 200);
}

(async function run(){
  await tenantOtpSmoke();
  await forgotPasswordSmoke();
  console.log('authPilotReadinessSmoke.test.js passed');
})().catch((error)=>{ console.error(error); process.exit(1); });
