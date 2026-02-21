#!/usr/bin/env node
const assert = require('assert');

const Firm = require('../src/models/Firm.model');
const User = require('../src/models/User.model');
const AuthAudit = require('../src/models/AuthAudit.model');
const SuperadminAudit = require('../src/models/SuperadminAudit.model');
const emailService = require('../src/services/email.service');
const {
  getFirmAdminDetails,
  updateFirmAdminStatus,
  forceResetFirmAdmin,
} = require('../src/controllers/superadmin.controller');

const createRes = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
});

const baseReq = () => ({
  params: { firmId: '507f1f77bcf86cd799439011' },
  body: {},
  user: { email: 'super@docketra.test', _id: '507f1f77bcf86cd799439099' },
  skipTransaction: true,
});

async function shouldViewFirmAdminDetailsSafely() {
  const originalFirmFindById = Firm.findById;
  const originalUserFindOne = User.findOne;
  const originalAuthAuditFindOne = AuthAudit.findOne;

  Firm.findById = () => ({ select: async () => ({ _id: 'firm-1', firmId: 'FIRM001', name: 'Acme' }) });
  User.findOne = async () => ({
    _id: 'admin-1',
    name: 'Default Admin',
    email: 'default.admin@example.com',
    xID: 'X000001',
    status: 'ACTIVE',
    passwordSetAt: new Date('2026-01-01T10:00:00.000Z'),
    inviteSentAt: new Date('2025-12-31T10:00:00.000Z'),
    failedLoginAttempts: 2,
    isLocked: false,
    passwordResetTokenHash: 'should-not-leak',
    passwordSetupTokenHash: 'should-not-leak',
  });
  AuthAudit.findOne = () => ({
    select: () => ({
      sort: async () => ({ timestamp: new Date('2026-02-20T10:00:00.000Z') }),
    }),
  });

  const req = baseReq();
  const res = createRes();
  await getFirmAdminDetails(req, res);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.name, 'Default Admin');
  assert.strictEqual(res.body.data.emailMasked, 'de***@example.com');
  assert.strictEqual(res.body.data.xID, 'X000001');
  assert.strictEqual(res.body.data.status, 'ACTIVE');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(res.body.data, 'passwordResetTokenHash'), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(res.body.data, 'passwordSetupTokenHash'), false);
  console.log('✓ GET firm admin details returns masked, safe fields only');

  Firm.findById = originalFirmFindById;
  User.findOne = originalUserFindOne;
  AuthAudit.findOne = originalAuthAuditFindOne;
}

async function shouldRejectInvalidAdminStatusTransitions() {
  const originalFirmFindById = Firm.findById;
  const originalUserFindOne = User.findOne;

  Firm.findById = () => ({ select: async () => ({ _id: 'firm-1', firmId: 'FIRM001', name: 'Acme' }) });
  User.findOne = async () => ({
    _id: 'admin-1',
    xID: 'X000001',
    status: 'DISABLED',
    mustSetPassword: true,
    isActive: false,
    save: async () => {},
  });

  const disableReq = baseReq();
  disableReq.body = { status: 'DISABLED' };
  const disableRes = createRes();
  await updateFirmAdminStatus(disableReq, disableRes);
  assert.strictEqual(disableRes.statusCode, 422);
  assert.strictEqual(disableRes.body.code, 'ADMIN_STATUS_UNCHANGED');

  const activateReq = baseReq();
  activateReq.body = { status: 'ACTIVE' };
  const activateRes = createRes();
  await updateFirmAdminStatus(activateReq, activateRes);
  assert.strictEqual(activateRes.statusCode, 422);
  assert.strictEqual(activateRes.body.code, 'ADMIN_PASSWORD_NOT_SET');
  console.log('✓ PATCH admin status enforces lifecycle rules');

  Firm.findById = originalFirmFindById;
  User.findOne = originalUserFindOne;
}

async function shouldForceResetOnlyForActiveAdminAndAudit() {
  const originalFirmFindById = Firm.findById;
  const originalUserFindOne = User.findOne;
  const originalSendReset = emailService.sendAdminPasswordResetEmail;
  const originalSuperadminAuditCreate = SuperadminAudit.create;

  let emailCalled = false;
  let auditAction = null;
  let adminSaved = null;

  Firm.findById = async () => ({ _id: 'firm-1', firmId: 'FIRM001', name: 'Acme', firmSlug: 'acme' });
  User.findOne = async () => {
    adminSaved = {
      _id: 'admin-1',
      name: 'Default Admin',
      email: 'default.admin@example.com',
      xID: 'X000001',
      status: 'ACTIVE',
      passwordSetupTokenHash: 'old-setup',
      passwordSetupExpires: new Date(),
      passwordResetTokenHash: null,
      passwordResetExpires: null,
      forcePasswordReset: false,
      mustChangePassword: false,
      save: async function save() {
        return this;
      },
    };
    return adminSaved;
  };
  emailService.sendAdminPasswordResetEmail = async () => {
    emailCalled = true;
    return { success: true };
  };
  SuperadminAudit.create = async (entry) => {
    auditAction = entry.actionType;
    return entry;
  };

  const req = baseReq();
  const res = createRes();
  await forceResetFirmAdmin(req, res);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.emailMasked, 'de***@example.com');
  assert.strictEqual(emailCalled, true);
  assert.strictEqual(auditAction, 'AdminForcePasswordReset');
  assert.strictEqual(adminSaved.passwordSetupTokenHash, null);
  assert.strictEqual(adminSaved.passwordSetupExpires, null);
  assert.ok(adminSaved.passwordResetTokenHash, 'password reset hash should be set');
  assert.ok(adminSaved.passwordResetExpires, 'password reset expiry should be set');
  assert.strictEqual(adminSaved.forcePasswordReset, true);
  console.log('✓ POST force-reset updates token lifecycle, emails admin, and audits action');

  Firm.findById = originalFirmFindById;
  User.findOne = originalUserFindOne;
  emailService.sendAdminPasswordResetEmail = originalSendReset;
  SuperadminAudit.create = originalSuperadminAuditCreate;
}

async function run() {
  try {
    await shouldViewFirmAdminDetailsSafely();
    await shouldRejectInvalidAdminStatusTransitions();
    await shouldForceResetOnlyForActiveAdminAndAudit();
    console.log('\n✅ SuperAdmin admin lifecycle tests passed.');
    process.exit(0);
  } catch (error) {
    console.error('✗ SuperAdmin admin lifecycle test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

run();
