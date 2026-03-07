#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Module = require('module');

const routeSchemas = require('../src/schemas/auth.routes.schema');
const User = require('../src/models/User.model');
const Firm = require('../src/models/Firm.model');
const emailService = require('../src/services/email.service');
const originalLoad = Module._load;

const clearModule = (modulePath) => {
  try {
    delete require.cache[require.resolve(modulePath)];
  } catch (_) {
    // ignore cache misses
  }
};

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
  };
  return { res, body };
};

const loadForgotPasswordController = () => {
  Module._load = function (request, parent, isMain) {
    if (request === '../middleware/wrapWriteHandler') {
      return (fn) => {
        const wrapped = async (req, res, next) => fn(req, res, next);
        wrapped.original = fn;
        return wrapped;
      };
    }
    if (request === '../services/audit.service') {
      return { logAuthEvent: async () => ({}) };
    }
    if (request === '../services/forensicAudit.service') {
      return {
        safeLogForensicAudit: async () => ({}),
        getRequestIp: () => '127.0.0.1',
        getRequestUserAgent: () => 'test-agent',
      };
    }
    return originalLoad.apply(this, arguments);
  };

  clearModule('../src/controllers/auth.controller');
  const { forgotPassword } = require('../src/controllers/auth.controller');
  Module._load = originalLoad;
  return forgotPassword.original;
};

function shouldValidateStrongPasswordsInAuthSchemas() {
  const changePasswordSchema = routeSchemas['POST /change-password'].body;
  const weakPassword = changePasswordSchema.safeParse({
    currentPassword: 'Old#1234',
    newPassword: 'password123',
  });
  const strongPassword = changePasswordSchema.safeParse({
    currentPassword: 'Old#1234',
    newPassword: 'Password#123',
  });

  assert.strictEqual(weakPassword.success, false, 'weak passwords should be rejected by auth route schema');
  assert.strictEqual(strongPassword.success, true, 'strong passwords should pass auth route schema');
  console.log('  ✓ enforces strong password policy in auth route schemas');
}

async function shouldRejectAmbiguousForgotPasswordRequests() {
  const forgotPasswordController = loadForgotPasswordController();
  const originalUserFind = User.find;

  User.find = () => ({
    limit: async () => ([{ _id: 'user-1' }, { _id: 'user-2' }]),
  });

  const { res, body } = createMockRes();

  try {
    await forgotPasswordController({
      body: { email: 'shared@example.com' },
      ip: '127.0.0.1',
      get: () => 'test-agent',
    }, res);
  } finally {
    User.find = originalUserFind;
  }

  assert.strictEqual(res.statusCode, 400, 'ambiguous forgot-password should require firm context');
  assert.strictEqual(body.success, false);
  assert.strictEqual(body.message, 'Multiple firms found. Please use your firm login URL.');
  console.log('  ✓ rejects ambiguous forgot-password requests without firm slug');
}

async function shouldScopeForgotPasswordByFirmSlug() {
  const forgotPasswordController = loadForgotPasswordController();
  const originalFirmFindOne = Firm.findOne;
  const originalUserFindOne = User.findOne;
  const originalGenerateSecureToken = emailService.generateSecureToken;
  const originalHashToken = emailService.hashToken;
  const originalSendForgotPasswordEmail = emailService.sendForgotPasswordEmail;

  const captured = {
    firmQuery: null,
    userQuery: null,
    emailToken: null,
  };

  const mockUser = {
    _id: 'user-1',
    xID: 'X000001',
    name: 'Alice',
    email: 'alice@example.com',
    firmId: 'firm-1',
    status: 'active',
    save: async () => {},
  };

  Firm.findOne = (query) => {
    captured.firmQuery = query;
    return {
      select: () => ({
        lean: async () => ({ _id: 'firm-1', firmSlug: 'acme-legal' }),
      }),
    };
  };
  User.findOne = async (query) => {
    captured.userQuery = query;
    return mockUser;
  };
  emailService.generateSecureToken = () => 'raw-token';
  emailService.hashToken = (value) => `hashed:${value}`;
  emailService.sendForgotPasswordEmail = async (_email, _name, token) => {
    captured.emailToken = token;
    return { success: true };
  };

  const { res, body } = createMockRes();

  try {
    await forgotPasswordController({
      body: { email: 'alice@example.com', firmSlug: 'Acme-Legal' },
      ip: '127.0.0.1',
      get: () => 'test-agent',
    }, res);
  } finally {
    Firm.findOne = originalFirmFindOne;
    User.findOne = originalUserFindOne;
    emailService.generateSecureToken = originalGenerateSecureToken;
    emailService.hashToken = originalHashToken;
    emailService.sendForgotPasswordEmail = originalSendForgotPasswordEmail;
  }

  assert.deepStrictEqual(captured.firmQuery, { firmSlug: 'acme-legal' }, 'forgot-password should resolve firm slug before lookup');
  assert.deepStrictEqual(captured.userQuery, {
    firmId: 'firm-1',
    email: 'alice@example.com',
    status: { $ne: 'deleted' },
  }, 'forgot-password should scope the account lookup to the selected firm');
  assert.strictEqual(captured.emailToken, 'raw-token', 'forgot-password should still deliver reset email for scoped account');
  assert.strictEqual(body.success, true);
  console.log('  ✓ scopes forgot-password lookup by provided firm slug');
}

async function run() {
  console.log('Running auth tenant workflow tests...');
  await shouldValidateStrongPasswordsInAuthSchemas();
  await shouldRejectAmbiguousForgotPasswordRequests();
  await shouldScopeForgotPasswordByFirmSlug();
  console.log('All auth tenant workflow tests passed.');
}

run().catch((error) => {
  Module._load = originalLoad;
  console.error('authTenantWorkflow tests failed:', error);
  process.exit(1);
});
