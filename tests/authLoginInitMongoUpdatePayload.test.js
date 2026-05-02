#!/usr/bin/env node
'use strict';

const assert = require('assert');
const bcrypt = require('bcrypt');
const Module = require('module');

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.JWT_PASSWORD_SETUP_SECRET = process.env.JWT_PASSWORD_SETUP_SECRET || 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
process.env.SUPERADMIN_PASSWORD_HASH = process.env.SUPERADMIN_PASSWORD_HASH || '$2b$10$wioLOkqqceK.iu9MZavNOua7yV2AzOpqlR4fuMWHf2.YeYpV4mEFC';
process.env.SUPERADMIN_XID = process.env.SUPERADMIN_XID || 'X999999';
process.env.SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || 'superadmin@example.com';
process.env.SUPERADMIN_OBJECT_ID = process.env.SUPERADMIN_OBJECT_ID || '000000000000000000000001';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/docketra-test';
process.env.ENCRYPTION_PROVIDER = process.env.ENCRYPTION_PROVIDER || 'disabled';

const User = require('../src/models/User.model');
const Firm = require('../src/models/Firm.model');
const LoginSession = require('../src/models/LoginSession.model');
const AuthAudit = require('../src/models/AuthAudit.model');
const AuditLog = require('../src/models/AuditLog.model');
const emailService = require('../src/services/email.service');
const { loginInit } = require('../src/controllers/auth.controller');
const originalModuleLoad = Module._load;

const createMockRes = () => {
  const body = {};
  const res = {
    statusCode: 200,
    headersSent: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.headersSent = true;
      Object.assign(body, payload);
      return this;
    },
    setHeader() {
      return this;
    },
    set() {
      return this;
    },
    cookie() {
      return this;
    },
    clearCookie() {
      return this;
    },
  };
  return { res, body };
};

const buildReq = (password) => ({
  method: 'POST',
  originalUrl: '/api/auth/login/init',
  body: {
    firmSlug: 'gupte-opc',
    xID: 'X000001',
    password,
  },
  params: { firmSlug: 'gupte-opc' },
  firmId: '507f1f77bcf86cd799439022',
  firmIdString: '507f1f77bcf86cd799439022',
  firmSlug: 'gupte-opc',
  firmName: 'Gupte OPC',
  firm: {
    _id: '507f1f77bcf86cd799439022',
    id: '507f1f77bcf86cd799439022',
    firmSlug: 'gupte-opc',
    name: 'Gupte OPC',
    status: 'active',
  },
  context: {
    firmId: '507f1f77bcf86cd799439022',
    firmSlug: 'gupte-opc',
  },
  loginScope: 'tenant',
  skipTransaction: true,
  ip: '127.0.0.1',
  get: () => 'test-agent',
});

const withPatchedAuthDeps = async (fn) => {
  const originals = {
    userFindOne: User.findOne,
    userFindOneAndUpdate: User.findOneAndUpdate,
    firmCountDocuments: Firm.countDocuments,
    loginSessionDeleteMany: LoginSession.deleteMany,
    loginSessionCreate: LoginSession.create,
    authAuditCreate: AuthAudit.create,
    auditLogCreate: AuditLog.create,
    sendLoginOtpEmail: emailService.sendLoginOtpEmail,
  };

  try {
    Firm.countDocuments = async () => 1;
    AuthAudit.create = async () => ({});
    AuditLog.create = async () => ({});
    await fn();
  } finally {
    User.findOne = originals.userFindOne;
    User.findOneAndUpdate = originals.userFindOneAndUpdate;
    Firm.countDocuments = originals.firmCountDocuments;
    LoginSession.deleteMany = originals.loginSessionDeleteMany;
    LoginSession.create = originals.loginSessionCreate;
    AuthAudit.create = originals.authAuditCreate;
    AuditLog.create = originals.auditLogCreate;
    emailService.sendLoginOtpEmail = originals.sendLoginOtpEmail;
  }
};

const buildTenantUser = async () => ({
  _id: { toString: () => '507f1f77bcf86cd799439011' },
  xID: 'X000001',
  xid: 'X000001',
  name: 'Tenant User',
  email: 'tenant@example.com',
  role: 'Employee',
  firmId: '507f1f77bcf86cd799439022',
  status: 'active',
  isActive: true,
  passwordHash: await bcrypt.hash('Correct#123', 4),
  mustSetPassword: false,
  failedLoginAttempts: 0,
  lockUntil: null,
  forcePasswordReset: false,
  allowedCategories: [],
  save: async function save() {
    return this;
  },
});

async function shouldProceedToOtpForValidTenantLoginInit() {
  await withPatchedAuthDeps(async () => {
    const user = await buildTenantUser();
    let capturedUserQuery = null;
    let capturedLoginSession = null;
    let deliveredOtp = null;

    User.find = async (query) => {
      capturedUserQuery = query;
      return [user];
    };
    LoginSession.deleteMany = async () => ({ deletedCount: 0 });
    LoginSession.create = async (payload) => {
      capturedLoginSession = payload;
      return payload;
    };
    emailService.sendLoginOtpEmail = async ({ otp }) => {
      deliveredOtp = otp;
      return { success: true };
    };

    const { res, body } = createMockRes();
    await loginInit(buildReq('Correct#123'), res, () => {});

    assert.strictEqual(res.statusCode, 200, 'valid tenant login init should succeed');
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.otpRequired, true, 'valid password should proceed to OTP challenge');
    assert.match(body.loginToken, /^[a-f0-9]{64}$/i, 'login token should be an opaque random token');
    assert.deepStrictEqual(capturedUserQuery, {
      xID: 'X000001',
      status: { $ne: 'deleted' },
      $or: [
        { firmId: { $in: ['507f1f77bcf86cd799439022'] } },
        { defaultClientId: { $in: ['507f1f77bcf86cd799439022'] } },
      ],
    });
    assert(capturedLoginSession, 'login init should persist a LoginSession');
    assert.strictEqual(capturedLoginSession.firmId, '507f1f77bcf86cd799439022');
    assert.strictEqual(capturedLoginSession.xID, 'X000001');
    assert.match(capturedLoginSession.tokenHash, /^[a-f0-9]{64}$/i, 'login session should store only the token hash');
    assert.notStrictEqual(capturedLoginSession.tokenHash, body.loginToken, 'raw login token must not be stored');
    assert.match(deliveredOtp, /^\d{6}$/, 'login init should send a six digit OTP');
  });
}

async function shouldAttachPrimitiveCanonicalFirmIdFromSlug() {
  const middlewarePath = require.resolve('../src/middleware/attachFirmFromSlug.middleware');
  const originalCacheEntry = require.cache[middlewarePath];
  let capturedSlug = null;

  try {
    delete require.cache[middlewarePath];
    Module._load = function patchedModuleLoad(request, parent, isMain) {
      if (request === '../services/tenantIdentity.service') {
        return {
          resolveTenantBySlug: async (slug) => {
            capturedSlug = slug;
            return {
              tenantId: '507f1f77bcf86cd799439022',
              firmIdString: 'FIRM001',
              firmSlug: 'gupte-opc',
              firmName: 'Gupte OPC',
              status: 'active',
              legacyFirmId: '507f1f77bcf86cd799439099',
            };
          },
        };
      }
      return originalModuleLoad.apply(this, arguments);
    };

    const { attachFirmFromSlug } = require('../src/middleware/attachFirmFromSlug.middleware');
    Module._load = originalModuleLoad;

    const req = { body: { firmSlug: 'Gupte-OPC' }, params: {}, context: {} };
    const res = createMockRes().res;
    let nextCalled = false;
    await attachFirmFromSlug(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(capturedSlug, 'gupte-opc');
    assert.strictEqual(nextCalled, true);
    assert.strictEqual(req.firmId, '507f1f77bcf86cd799439022');
    assert.strictEqual(typeof req.firmId, 'string', 'req.firmId should be a primitive ID string');
    assert.notStrictEqual(req.firmId, req.firm, 'req.firmId must not be the firm object');
    assert.strictEqual(req.firm._id, req.firmId);
    assert.strictEqual(req.context.tenantId, req.firmId);
  } finally {
    Module._load = originalModuleLoad;
    delete require.cache[middlewarePath];
    if (originalCacheEntry) {
      require.cache[middlewarePath] = originalCacheEntry;
    }
  }
}

async function shouldUseObjectUpdateForInvalidPasswordAttemptTracking() {
  await withPatchedAuthDeps(async () => {
    const user = await buildTenantUser();
    let capturedUpdate = null;

    User.findOne = async () => user;
    User.findOneAndUpdate = async (_filter, update) => {
      capturedUpdate = update;
      assert.strictEqual(Array.isArray(update), false, 'failed login tracking must not use a Mongo update pipeline array');
      return {
        ...user,
        failedLoginAttempts: 1,
        lockUntil: null,
      };
    };

    const { res, body } = createMockRes();
    await loginInit(buildReq('Wrong#123'), res, () => {});

    assert.strictEqual(res.statusCode, 401, 'invalid password should fail safely');
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.message, 'Invalid xID or password');
    assert.deepStrictEqual(capturedUpdate, { $inc: { failedLoginAttempts: 1 } });
  });
}

(async () => {
  try {
    await shouldProceedToOtpForValidTenantLoginInit();
    await shouldAttachPrimitiveCanonicalFirmIdFromSlug();
    await shouldUseObjectUpdateForInvalidPasswordAttemptTracking();
    console.log('authLoginInitMongoUpdatePayload tests passed.');
  } catch (error) {
    console.error('authLoginInitMongoUpdatePayload tests failed:', error);
    process.exit(1);
  }
})();
