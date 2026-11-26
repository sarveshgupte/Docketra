#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Module = require('module');
const mongoose = require('mongoose');

// Avoid native bcrypt binary dependency during pure unit execution on non-CI hosts
const bcryptPath = require.resolve('bcrypt');
require.cache[bcryptPath] = {
  id: bcryptPath,
  filename: bcryptPath,
  loaded: true,
  exports: {
    compare: async (candidate, stored) => stored === `hashed:${candidate}` || candidate === stored,
    hash: async (value) => `hashed:${value}`,
  },
};

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'ci-placeholder-test-secret-key-that-is-at-least-32-chars';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/docketra';
process.env.ENCRYPTION_PROVIDER = 'disabled';
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'test-google-client-secret';
process.env.GOOGLE_AUTH_REDIRECT_URI = process.env.GOOGLE_AUTH_REDIRECT_URI || 'https://api.example.com/api/auth/google/callback';
process.env.DISABLE_GOOGLE_AUTH = 'false';
process.env.FRONTEND_URL = 'https://app.docketshq.com';
process.env.SUPERADMIN_PASSWORD_HASH = process.env.SUPERADMIN_PASSWORD_HASH || '$2b$10$abcdefghijklmnopqrstuu0Lz3M0RtZpmjHtkobaN6D2PfYZ7RUTy';
process.env.SUPERADMIN_XID = process.env.SUPERADMIN_XID || 'X000001';
process.env.SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || 'superadmin@example.com';
process.env.SUPERADMIN_OBJECT_ID = process.env.SUPERADMIN_OBJECT_ID || '000000000000000000000001';

const originalLoad = Module._load;

const clearModule = (modulePath) => {
  try {
    delete require.cache[require.resolve(modulePath)];
  } catch (_) {
    // ignore cache misses
  }
};

function createMockRes() {
  const state = {
    statusCode: 200,
    body: null,
    redirectUrl: null,
    headers: {},
    cookies: [],
  };
  return {
    state,
    status(code) { state.statusCode = code; return this; },
    json(payload) { state.body = payload; return this; },
    redirect(url) { state.redirectUrl = url; return this; },
    setHeader(k, v) { state.headers[k] = v; },
    getHeader(k) { return state.headers[k]; },
    cookie(name, value, options) { state.cookies.push({ name, value, options }); return this; },
    clearCookie() { return this; },
  };
}

function createFakeTransactionSession() {
  return {
    withTransaction: async (fn) => fn(),
    endSession: async () => {},
  };
}

async function testManualSignupFlow() {
  const signupSessions = new Map();
  const createdFirms = [];
  const createdClients = [];
  const createdUsers = [];
  const sentEmails = [];
  const auditEvents = [];

  const makeQuery = (resolved) => ({
    session() { return this; },
    select() { return this; },
    sort() { return this; },
    lean: async () => resolved,
    then(onFulfilled, onRejected) {
      return Promise.resolve(resolved).then(onFulfilled, onRejected);
    },
  });

  const mockUserModel = {
    findOne: (query) => {
      const match = createdUsers.find((u) => {
        if (query.email && u.email === query.email) return true;
        if (Array.isArray(query.$or)) {
          return query.$or.some((clause) => (
            (clause.email && u.email === clause.email)
            || (clause.phoneNumber && u.phoneNumber === clause.phoneNumber)
          ));
        }
        return false;
      }) || null;
      return makeQuery(match);
    },
    create: async ([doc]) => {
      const saved = { _id: new mongoose.Types.ObjectId(), ...doc };
      createdUsers.push(saved);
      return [saved];
    },
  };

  const mockSignupSessionModel = {
    deleteMany: async (query) => {
      if (query?.email) signupSessions.delete(query.email);
      return { deletedCount: 1 };
    },
    deleteOne: async (query) => {
      for (const [k, v] of signupSessions.entries()) {
        if (String(v._id) === String(query?._id)) {
          signupSessions.delete(k);
        }
      }
      return { deletedCount: 1 };
    },
    create: async (doc) => {
      const saved = {
        _id: 'signup-sess-1',
        ...doc,
        save: async function save() {
          signupSessions.set(this.email, this);
        },
      };
      signupSessions.set(doc.email, saved);
      return saved;
    },
    findOne: (query) => {
      const record = signupSessions.get(query?.email) || null;
      const matchesProvider = record && (!query?.provider || record.provider === query.provider) ? record : null;
      const exec = Promise.resolve(matchesProvider);
      exec.session = () => Promise.resolve(matchesProvider);
      return exec;
    },
  };

  const mockFirmModel = {
    countDocuments: async () => createdFirms.length,
    findOne: (query = {}) => makeQuery(query?.firmSlug ? (createdFirms[0] || null) : null),
    find: () => makeQuery(createdFirms),
    create: async ([doc]) => {
      const saved = {
        _id: new mongoose.Types.ObjectId(),
        isSetupComplete: false,
        ...doc,
        save: async function save() { return this; },
      };
      createdFirms.push(saved);
      return [saved];
    },
  };

  const mockClientModel = {
    create: async ([doc]) => {
      const saved = { ...doc };
      createdClients.push(saved);
      return [saved];
    },
  };

  const fakeSession = createFakeTransactionSession();

  Module._load = function (request, parent, isMain) {
    if (request === '../models/User.model') return mockUserModel;
    if (request === '../models/SignupSession.model') return mockSignupSessionModel;
    if (request === '../models/Firm.model') return mockFirmModel;
    if (request === '../models/Client.model') return mockClientModel;
    if (request === '../models/AuthAudit.model') return { create: async () => ({}) };
    if (request === '../utils/log') return { info: () => {}, warn: () => {}, error: (...args) => console.error('[TEST_LOG_ERROR]', ...args) };
    if (request === './signupRateLimit.service') {
      return {
        consumeSignupQuota: async () => ({ allowed: true }),
        consumeOtpAttempt: async () => ({ allowed: true, attempts: 1 }),
        consumeOtpResendQuota: async () => ({ allowed: true }),
        clearOtpAttempts: async () => {},
      };
    }
    if (request === './redisLock.service') {
      return {
        acquireLock: async () => ({ acquired: true }),
        releaseLock: async () => {},
      };
    }
    if (request === './email.service') {
      return {
        sendSignupOtpEmail: async (payload) => {
          sentEmails.push({ type: 'otp', ...payload });
          return { success: true, messageId: 'otp-msg-1' };
        },
        sendFirmSetupEmail: async (payload) => {
          sentEmails.push({ type: 'welcome', ...payload });
          return { success: true, messageId: 'welcome-msg-1' };
        },
        sendFirmCreatedEmail: async () => ({ success: true }),
      };
    }
    if (request === './firmSetup.service') {
      return { setupDefaultFirm: async () => ({ categories: 2, workbaskets: 1 }) };
    }
    if (request === './xIDGenerator') {
      return { generateNextXID: async () => 'X000001' };
    }
    if (request === './clientIdGenerator') {
      return { generateNextClientId: async () => 'C000001' };
    }
    if (request === '../security/encryption.service') {
      return { ensureTenantKey: async () => {} };
    }
    if (request === './audit.service') {
      return { logAuthEvent: async () => ({}) };
    }
    if (request === './securityAudit.service') {
      return {
        SECURITY_AUDIT_ACTIONS: {
          SIGNUP_INIT_ATTEMPT: 'SIGNUP_INIT_ATTEMPT',
          SIGNUP_OTP_SENT: 'SIGNUP_OTP_SENT',
          SIGNUP_OTP_VERIFY_ATTEMPT: 'SIGNUP_OTP_VERIFY_ATTEMPT',
          SIGNUP_OTP_VERIFY_FAILED: 'SIGNUP_OTP_VERIFY_FAILED',
          SIGNUP_OTP_VERIFIED: 'SIGNUP_OTP_VERIFIED',
          SIGNUP_COMPLETED: 'SIGNUP_COMPLETED',
        },
        logSecurityAuditEvent: async (evt) => { auditEvents.push(evt.action); },
      };
    }
    return originalLoad.apply(this, arguments);
  };

  try {
    clearModule('../src/services/tenantIdentity.service');
    clearModule('../src/services/signup.service');
    clearModule('../src/services/authSignup.service');

    const signupService = require('../src/services/signup.service');
    const createAuthSignupService = require('../src/services/authSignup.service');
    const authSignupService = createAuthSignupService({
      signupService,
      getSession: () => fakeSession,
      mongoose: { startSession: async () => fakeSession },
      User: mockUserModel,
    });

    // Reject missing pilot clickwrap consent
    const resMissingConsent = createMockRes();
    await authSignupService.signupInit({
      body: {
        name: 'Sarvesh Partner',
        email: 'sarvesh@apexpilot.in',
        password: 'StrongPassword#1',
        firmName: 'Apex CS & Legal',
        phone: '9876543210',
        agreedToPilotTerms: false,
      },
      headers: { 'user-agent': 'UnitTestAgent/1.0' },
      ip: '127.0.0.1',
    }, resMissingConsent);
    assert.strictEqual(resMissingConsent.state.statusCode, 400);

    // Initiate valid signup
    const resInit = createMockRes();
    await authSignupService.signupInit({
      body: {
        name: 'Sarvesh Partner',
        email: 'sarvesh@apexpilot.in',
        password: 'StrongPassword#1',
        firmName: 'Apex CS & Legal',
        phone: '9876543210',
        agreedToPilotTerms: true,
        termsVersion: 'v1.0_pilot_2026',
        privacyVersion: 'v1.0_pilot_2026',
      },
      headers: { 'user-agent': 'UnitTestAgent/1.0' },
      ip: '203.0.113.10',
    }, resInit);

    assert.strictEqual(resInit.state.statusCode, 201);
    assert.strictEqual(resInit.state.body.success, true);
    const otpMail = sentEmails.find((e) => e.type === 'otp');
    assert.ok(otpMail && /^\d{6}$/.test(otpMail.otp), 'Signup init must dispatch a 6-digit OTP email');

    // Wrong OTP must fail cleanly without creating tenant
    const resBadOtp = createMockRes();
    await authSignupService.signupVerify({
      body: { email: 'sarvesh@apexpilot.in', otp: '000000' === otpMail.otp ? '111111' : '000000' },
    }, resBadOtp);
    assert.strictEqual(resBadOtp.state.statusCode, 400);
    assert.strictEqual(createdFirms.length, 0);

    // Correct OTP completes signup inside transaction, creates Firm/Client/User, sends welcome email
    const resVerify = createMockRes();
    await authSignupService.signupVerify({
      body: { email: 'sarvesh@apexpilot.in', otp: otpMail.otp },
      headers: { 'user-agent': 'UnitTestAgent/1.0' },
      ip: '203.0.113.10',
    }, resVerify);

    assert.strictEqual(resVerify.state.statusCode, 201);
    assert.strictEqual(resVerify.state.body.success, true);
    assert.strictEqual(resVerify.state.body.data.xid, 'X000001');
    assert.ok(resVerify.state.body.data.firmSlug, 'Verify response must include generated firmSlug');
    assert.strictEqual(resVerify.state.body.data.redirectPath, `/${resVerify.state.body.data.firmSlug}/login`);
    assert.strictEqual(createdFirms.length, 1);
    assert.strictEqual(createdFirms[0].isSetupComplete, false);
    assert.strictEqual(createdClients.length, 1);
    assert.strictEqual(createdUsers.length, 1);
    assert.strictEqual(createdUsers[0].role, 'PRIMARY_ADMIN');
    assert.strictEqual(signupSessions.size, 0, 'Verified signup session must be deleted');
    assert.ok(sentEmails.some((e) => e.type === 'welcome' && e.xid === 'X000001'), 'Welcome email with xID must be sent');
    assert.ok(auditEvents.includes('SIGNUP_COMPLETED'));
  } finally {
    Module._load = originalLoad;
  }

  console.log('  ✓ Manual firm signup (init -> wrong OTP reject -> verify -> transaction provisioning) passed');
}

async function testGoogleWorkspaceSignupFlow() {
  const loginSessions = new Map();
  const provisionCalls = [];
  const welcomeEmails = [];
  const cookieCalls = [];
  const googleAuthServiceReal = require('../src/services/authGoogle.service');

  const existingFirmId = new mongoose.Types.ObjectId();
  const existingUserId = new mongoose.Types.ObjectId();

  let googleTicketProfile = {
    sub: 'google-sub-1',
    email: 'founder@lexpartners.in',
    name: 'Meera Founder',
    email_verified: true,
  };

  let createdAccountActive = false;

  const mockLoginSessionModel = {
    deleteMany: async ({ userId }) => {
      for (const [k, v] of loginSessions.entries()) {
        if (String(v.userId) === String(userId) && v.consumedAt === null) {
          loginSessions.delete(k);
        }
      }
      return { deletedCount: 1 };
    },
    create: async (doc) => {
      const saved = { _id: 'ls-1', ...doc };
      loginSessions.set(doc.tokenHash, saved);
      return saved;
    },
    findOne: async ({ tokenHash, consumedAt, expiresAt }) => {
      const entry = loginSessions.get(tokenHash);
      if (!entry) return null;
      if (consumedAt === null && entry.consumedAt !== null) return null;
      if (expiresAt?.$gt && !(entry.expiresAt > expiresAt.$gt)) return null;
      return entry;
    },
    updateOne: async ({ _id }, { $set }) => {
      for (const entry of loginSessions.values()) {
        if (entry._id === _id) {
          Object.assign(entry, $set);
        }
      }
      return { modifiedCount: 1 };
    },
  };

  const mockUserModel = {
    findOne: async (query) => {
      if (query._id && String(query._id) === String(existingUserId) && createdAccountActive) {
        return {
          _id: existingUserId,
          firmId: existingFirmId,
          defaultClientId: existingFirmId,
          xID: 'X000001',
          name: 'Meera Founder',
          email: 'founder@lexpartners.in',
          role: 'PRIMARY_ADMIN',
          isActive: true,
          status: 'active',
          allowedCategories: [],
          mustSetPassword: false,
          passwordSetAt: new Date(),
          save: async () => {},
        };
      }
      return null;
    },
  };

  const fakeSession = createFakeTransactionSession();

  Module._load = function (request, parent, isMain) {
    if (request === '../middleware/wrapWriteHandler') return (fn) => fn;
    if (request === '../utils/getSession') return () => fakeSession;
    if (request === '../models/User.model') return mockUserModel;
    if (request === '../models/Firm.model') {
      return {
        findById: () => ({ select: () => ({ lean: async () => ({ _id: existingFirmId, firmSlug: 'lex-partners', name: 'Lex Partners' }) }) }),
      };
    }
    if (request === '../models/Client.model') {
      return {
        findById: () => ({
          select: () => ({
            lean: async () => ({ _id: existingFirmId, firmId: existingFirmId, isDefaultClient: true }),
          }),
        }),
      };
    }
    if (request === '../models/Team.model') return {};
    if (request === '../models/UserProfile.model') return {};
    if (request === '../models/AuthAudit.model') return { create: async () => ({}) };
    if (request === '../models/RefreshToken.model') return { create: async () => ({}), deleteMany: async () => ({}) };
    if (request === '../models/AuthIdentity.model') return {};
    if (request === '../models/LoginSession.model') return mockLoginSessionModel;
    if (request === '../services/featureGate.service') return { ensureGoogleAuthEnabled: () => true };
    if (request === '../services/authGoogle.service') {
      return {
        ...googleAuthServiceReal,
        getGoogleOAuthClient: () => ({
          generateAuthUrl: ({ state }) => `https://accounts.google.com/o/oauth2/v2/auth?state=${encodeURIComponent(state)}`,
          getToken: async () => ({ tokens: { id_token: 'mock-id-token' } }),
          setCredentials: () => {},
          verifyIdToken: async () => ({ getPayload: () => googleTicketProfile }),
        }),
      };
    }
    if (request === '../services/signup.service') {
      return {
        createFirmAndAdmin: async (args) => {
          provisionCalls.push(args);
          createdAccountActive = true;
          return {
            adminXID: 'X000001',
            firmSlug: 'lex-partners',
            firmUrl: 'https://app.docketshq.com/lex-partners/login',
            firmId: existingFirmId,
            userId: existingUserId,
            defaultClientId: existingFirmId,
          };
        },
        sendSignupWelcomeEmail: async (args) => {
          welcomeEmails.push(args);
          return { success: true };
        },
      };
    }
    if (request === '../services/tenantIdentity.service') {
      return {
        resolveCanonicalTenantForUser: async () => ({
          tenantId: String(existingFirmId),
          firmSlug: 'lex-partners',
          defaultClientId: String(existingFirmId),
          status: 'ACTIVE',
        }),
        resolveCanonicalTenantFromFirmId: async () => null,
        resolveTenantBySlug: async () => null,
      };
    }
    if (request === '../services/defaultClient.guard') return { getOrCreateDefaultClient: async () => ({ _id: existingFirmId }) };
    if (request === '../services/authSession.service') {
      return () => ({
        generateAndStoreRefreshToken: async () => ({ refreshToken: 'mock-refresh-token' }),
        setAuthCookies: (_res, tokens) => cookieCalls.push(tokens),
      });
    }
    if (request === '../services/audit.service') return { logAuthEvent: async () => ({}) };
    if (request === '../services/forensicAudit.service') {
      return {
        safeLogForensicAudit: async () => null,
        logForensicAudit: async () => [],
      };
    }
    if (request === '../services/securityAudit.service') {
      return {
        SECURITY_AUDIT_ACTIONS: { LOGIN_SUCCESS: 'LOGIN_SUCCESS' },
        logSecurityAuditEvent: async () => {},
      };
    }
    if (request === '../services/securityTelemetry.service') {
      return {
        noteLoginFailure: () => {},
        noteLockedAccountAttempt: () => {},
        noteSuccessfulLogin: () => {},
        noteRefreshTokenFailure: () => {},
        noteRefreshTokenUse: () => {},
        getRequestCountry: () => 'IN',
      };
    }
    if (request === '../services/tenantMetrics.service') return { incrementTenantMetric: async () => {} };
    if (request === '../utils/log') return { info: () => {}, warn: () => {}, error: (...args) => console.error('[TEST_LOG_ERROR]', ...args) };
    return originalLoad.apply(this, arguments);
  };

  const originalStartSession = mongoose.startSession;
  mongoose.startSession = async () => fakeSession;

  try {
    clearModule('../src/controllers/auth.controller');
    const authController = require('../src/controllers/auth.controller');

    // A) startGoogleAuth with firmName -> callback immediately provisions workspace
    const startRes = createMockRes();
    await authController.startGoogleAuth({
      query: { intent: 'signup', firmName: 'Lex Partners', phone: '9876543210', agreedToPilotTerms: 'true' },
      headers: { origin: 'https://app.docketshq.com' },
    }, startRes);

    assert.ok(startRes.state.redirectUrl?.startsWith('https://accounts.google.com/o/oauth2/v2/auth?'));
    const directState = new URL(startRes.state.redirectUrl).searchParams.get('state');

    const callbackDirectRes = createMockRes();
    await authController.googleAuthCallback({
      query: { code: 'google-code-1', state: directState },
      headers: { 'user-agent': 'GoogleBrowser/1.0' },
      ip: '203.0.113.99',
    }, callbackDirectRes);

    const directRedirect = new URL(callbackDirectRes.state.redirectUrl);
    assert.strictEqual(directRedirect.pathname, '/oauth/post-auth');
    assert.strictEqual(directRedirect.searchParams.get('mode'), 'signup');
    assert.strictEqual(directRedirect.searchParams.get('firmSlug'), 'lex-partners');
    assert.ok(directRedirect.searchParams.get('exchangeToken'));
    assert.strictEqual(provisionCalls[0].authProvider, 'google');
    assert.strictEqual(welcomeEmails[0].authProvider, 'google');

    // Exchange one-time token for HTTP-only session cookies
    const exchangeRes = createMockRes();
    await authController.exchangeGoogleAuth({
      body: { exchangeToken: directRedirect.searchParams.get('exchangeToken'), firmSlug: 'lex-partners' },
      headers: { 'user-agent': 'GoogleBrowser/1.0' },
      ip: '203.0.113.99',
      get: (h) => (h === 'user-agent' ? 'GoogleBrowser/1.0' : ''),
    }, exchangeRes);

    assert.strictEqual(exchangeRes.state.statusCode, 200);
    assert.strictEqual(exchangeRes.state.body.success, true);
    assert.strictEqual(exchangeRes.state.body.accessToken, undefined, 'accessToken must be stripped from JSON body');
    assert.strictEqual(exchangeRes.state.body.refreshToken, undefined, 'refreshToken must be stripped from JSON body');
    assert.strictEqual(cookieCalls.length, 1, 'HTTP-only cookies must be set after exchange');

    // B) startGoogleAuth without firmName -> callback returns signup_pending -> completeGoogleSignup provisions workspace
    const pendingStartRes = createMockRes();
    await authController.startGoogleAuth({
      query: { intent: 'signup' },
      headers: { origin: 'https://app.docketshq.com' },
    }, pendingStartRes);
    const pendingState = new URL(pendingStartRes.state.redirectUrl).searchParams.get('state');

    const callbackPendingRes = createMockRes();
    await authController.googleAuthCallback({
      query: { code: 'google-code-2', state: pendingState },
      headers: {},
    }, callbackPendingRes);

    const pendingRedirect = new URL(callbackPendingRes.state.redirectUrl);
    assert.strictEqual(pendingRedirect.searchParams.get('mode'), 'signup_pending');
    const pendingToken = pendingRedirect.searchParams.get('googlePendingToken');
    assert.ok(pendingToken, 'Pending Google signup must include googlePendingToken');

    const completeRes = createMockRes();
    await authController.completeGoogleSignup({
      body: { googlePendingToken: pendingToken, firmName: 'Lex Partners Pending', phone: '9123456780' },
      headers: { 'user-agent': 'GoogleBrowser/1.0' },
      ip: '203.0.113.100',
    }, completeRes);

    assert.strictEqual(completeRes.state.statusCode, 201);
    assert.strictEqual(completeRes.state.body.success, true);
    assert.strictEqual(completeRes.state.body.data.firmSlug, 'lex-partners');
    assert.strictEqual(completeRes.state.body.data.xid, 'X000001');
    assert.ok(completeRes.state.body.data.exchangeToken);
  } finally {
    mongoose.startSession = originalStartSession;
    Module._load = originalLoad;
  }

  console.log('  ✓ Google Workspace signup (direct + signup_pending + completeGoogleSignup + exchangeGoogleAuth) passed');
}

async function testFirmOnboardingCompletionController() {
  const Firm = require('../src/models/Firm.model');
  const originalFindById = Firm.findById;
  const originalFindOne = Firm.findOne;

  let savedCount = 0;
  const mockFirmDoc = {
    _id: '507f1f77bcf86cd799439011',
    firmId: 'FIRM101',
    name: 'Lex Partners',
    firmSlug: 'lex-partners',
    isSetupComplete: false,
    setupMetadata: {},
    settings: {},
    save: async function save() {
      savedCount += 1;
      return this;
    },
  };

  Firm.findById = async (id) => (String(id) === mockFirmDoc._id ? mockFirmDoc : null);
  Firm.findOne = async () => mockFirmDoc;

  try {
    clearModule('../src/controllers/firm.controller');
    const { getFirmSetupStatus, completeFirmSetup } = require('../src/controllers/firm.controller');

    const statusRes = createMockRes();
    await getFirmSetupStatus({ ownershipFirmId: mockFirmDoc._id }, statusRes);
    assert.strictEqual(statusRes.state.statusCode, 200);
    assert.strictEqual(statusRes.state.body.data.isSetupComplete, false);

    const completeRes = createMockRes();
    await completeFirmSetup({
      ownershipFirmId: mockFirmDoc._id,
      user: { _id: 'user-admin-1' },
      body: { name: 'Lex Partners LLP', practiceType: 'cs_legal' },
    }, completeRes);

    assert.strictEqual(completeRes.state.statusCode, 200);
    assert.strictEqual(completeRes.state.body.success, true);
    assert.strictEqual(completeRes.state.body.data.isSetupComplete, true);
    assert.strictEqual(completeRes.state.body.data.firmName, 'Lex Partners LLP');
    assert.strictEqual(mockFirmDoc.isSetupComplete, true);
    assert.strictEqual(mockFirmDoc.settings.firm.practiceType, 'cs_legal');
    assert.strictEqual(savedCount, 1);
  } finally {
    Firm.findById = originalFindById;
    Firm.findOne = originalFindOne;
  }

  console.log('  ✓ Firm onboarding completion (getFirmSetupStatus -> completeFirmSetup) passed');
}

async function run() {
  console.log('Running Firm Onboarding & Signup Journey tests...');
  await testManualSignupFlow();
  await testGoogleWorkspaceSignupFlow();
  await testFirmOnboardingCompletionController();
  console.log('✅ All firmOnboardingSignupJourney tests passed!');
}

run().catch((error) => {
  console.error('❌ firmOnboardingSignupJourney test failed:', error);
  process.exit(1);
});
