const assert = require('assert');
const mongoose = require('mongoose');
const User = require('../src/models/User.model');
const Firm = require('../src/models/Firm.model');
const SignupSession = require('../src/models/SignupSession.model');
const securityAuditPath = require.resolve('../src/services/securityAudit.service');
require.cache[securityAuditPath] = {
  id: securityAuditPath,
  filename: securityAuditPath,
  loaded: true,
  exports: {
    SECURITY_AUDIT_ACTIONS: {
      SIGNUP_INIT_ATTEMPT: 'SIGNUP_INIT_ATTEMPT',
      SIGNUP_OTP_SENT: 'SIGNUP_OTP_SENT',
      SIGNUP_OTP_VERIFY_ATTEMPT: 'SIGNUP_OTP_VERIFY_ATTEMPT',
      SIGNUP_OTP_VERIFY_FAILED: 'SIGNUP_OTP_VERIFY_FAILED',
      SIGNUP_OTP_VERIFIED: 'SIGNUP_OTP_VERIFIED',
      SIGNUP_COMPLETED: 'SIGNUP_COMPLETED',
    },
    logSecurityAuditEvent: async () => {},
  },
};

const createAuthSignupService = require('../src/services/authSignup.service');
const authRouteSchemas = require('../src/schemas/auth.routes.schema');
const { sanitizeUserForOutput } = require('../src/utils/userSerialization');

(async () => {
  console.log('Testing Clickwrap Consent & Pilot Terms Audit System...');

  // 1. Verify schema contract contains consent fields in POST /signup/init
  const signupInitSchema = authRouteSchemas['POST /signup/init'];
  assert(signupInitSchema, 'POST /signup/init schema must exist');
  
  const parsedValid = signupInitSchema.body.safeParse({
    name: 'Test Partner',
    email: 'partner@example.com',
    password: 'Password123!',
    firmName: 'Acme & Associates',
    phone: '9876543210',
    agreedToPilotTerms: true,
    agreedToTerms: true,
    termsVersion: 'v1.0_pilot_2026',
    privacyVersion: 'v1.0_pilot_2026',
  });
  assert(parsedValid.success, 'Schema parse should succeed with consent fields');
  assert.strictEqual(parsedValid.data.agreedToPilotTerms, true);
  assert.strictEqual(parsedValid.data.termsVersion, 'v1.0_pilot_2026');

  // 2. Verify authSignupService rejects registration when agreedToPilotTerms is false/missing
  const dummyRes = () => {
    const res = {
      statusCode: 200,
      jsonPayload: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.jsonPayload = payload;
        return this;
      },
    };
    return res;
  };

  const mockSignupService = {
    initiateSignup: async (args) => {
      mockSignupService.lastArgs = args;
      return { success: true, message: 'OTP sent' };
    },
  };

  const authSignupService = createAuthSignupService({
    signupService: mockSignupService,
    getSession: () => null,
    mongoose: {
      startSession: async () => ({
        withTransaction: async (fn) => fn(),
        endSession: async () => {},
      }),
    },
    User: { findOne: () => ({ session: async () => null }) },
  });

  // Rejection test without consent
  const resRejected = dummyRes();
  await authSignupService.signupInit({
    body: {
      name: 'Test Partner',
      email: 'partner@example.com',
      password: 'Password123!',
      firmName: 'Acme & Associates',
      phone: '9876543210',
      agreedToPilotTerms: false,
    },
    headers: { 'user-agent': 'Mozilla/5.0 TestBrowser' },
    ip: '203.0.113.42',
  }, resRejected);

  assert.strictEqual(resRejected.statusCode, 400, 'Must return 400 Bad Request when consent is false');
  assert(resRejected.jsonPayload?.message.includes('Pilot Evaluation Terms'), 'Must explain terms agreement is required');

  // Success test with consent
  const resAccepted = dummyRes();
  await authSignupService.signupInit({
    body: {
      name: 'Test Partner',
      email: 'partner@example.com',
      password: 'Password123!',
      firmName: 'Acme & Associates',
      phone: '9876543210',
      agreedToPilotTerms: true,
      termsVersion: 'v1.0_pilot_2026',
      privacyVersion: 'v1.0_pilot_2026',
    },
    headers: {
      'user-agent': 'Mozilla/5.0 TestBrowser/1.0',
      'x-forwarded-for': '198.51.100.25, 10.0.0.1',
    },
    ip: '127.0.0.1',
  }, resAccepted);

  assert.strictEqual(resAccepted.statusCode, 201, 'Must return 201 when consent is given');
  assert(mockSignupService.lastArgs?.legalConsent, 'Must construct legalConsent object');
  assert.strictEqual(mockSignupService.lastArgs.legalConsent.agreedToPilotTerms, true);
  assert.strictEqual(mockSignupService.lastArgs.legalConsent.ipAddress, '198.51.100.25', 'Must capture client IP');
  assert.strictEqual(mockSignupService.lastArgs.legalConsent.userAgent, 'Mozilla/5.0 TestBrowser/1.0', 'Must capture User-Agent');
  assert.strictEqual(mockSignupService.lastArgs.legalConsent.termsVersion, 'v1.0_pilot_2026');
  assert.strictEqual(mockSignupService.lastArgs.legalConsent.agreementType, 'PILOT_CLICKWRAP');

  // 3. Verify Mongoose model schemas accept legalConsent subdocument
  const consentData = {
    agreedToPilotTerms: true,
    agreedAt: new Date('2026-03-15T10:00:00Z'),
    ipAddress: '198.51.100.25',
    userAgent: 'Mozilla/5.0 TestBrowser/1.0',
    termsVersion: 'v1.0_pilot_2026',
    privacyVersion: 'v1.0_pilot_2026',
    agreementType: 'PILOT_CLICKWRAP',
  };

  const testUser = new User({
    xID: 'X000001',
    name: 'Admin User',
    email: 'admin@acme.test',
    legalConsent: consentData,
  });
  assert.strictEqual(testUser.legalConsent.agreedToPilotTerms, true);
  assert.strictEqual(testUser.legalConsent.ipAddress, '198.51.100.25');

  const testFirm = new Firm({
    firmId: 'FIRM999',
    name: 'Acme CS Practice',
    firmSlug: 'acme-cs-practice',
    legalConsent: consentData,
  });
  assert.strictEqual(testFirm.legalConsent.agreedToPilotTerms, true);
  assert.strictEqual(testFirm.legalConsent.termsVersion, 'v1.0_pilot_2026');

  const testSession = new SignupSession({
    name: 'Admin User',
    email: 'admin@acme.test',
    firmName: 'Acme CS Practice',
    passwordHash: 'dummy',
    phone: '9876543210',
    legalConsent: consentData,
  });
  assert.strictEqual(testSession.legalConsent.agreedToPilotTerms, true);

  // 4. Verify User Serialization sanitizes IP and User-Agent from public output
  const safeUser = sanitizeUserForOutput(testUser.toJSON());
  assert.strictEqual(safeUser.legalConsent?.agreedToPilotTerms, true);
  assert.strictEqual(safeUser.legalConsent?.termsVersion, 'v1.0_pilot_2026');
  assert.strictEqual(safeUser.legalConsent?.ipAddress, undefined, 'Must sanitize IP from public user JSON');
  assert.strictEqual(safeUser.legalConsent?.userAgent, undefined, 'Must sanitize UserAgent from public user JSON');

  console.log('✅ All Clickwrap Consent & Pilot Terms Audit tests passed successfully!');
})();
