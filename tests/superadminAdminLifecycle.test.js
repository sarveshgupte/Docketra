#!/usr/bin/env node
const assert = require('assert');

const Firm = require('../src/models/Firm.model');
const User = require('../src/models/User.model');
const AuthAudit = require('../src/models/AuthAudit.model');
const SuperadminAudit = require('../src/models/SuperadminAudit.model');
const emailService = require('../src/services/email.service');
const {
  getFirmAdminDetails,
  listFirmAdmins,
  createFirmAdmin,
  deleteFirmAdmin,
  updateFirmAdminStatus,
  forceResetFirmAdmin,
} = require('../src/controllers/superadmin.controller');
const xIDGenerator = require('../src/services/xIDGenerator');

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

async function shouldListFirmAdminsMaskedWithoutTokens() {
  const originalFirmFindById = Firm.findById;
  const originalUserFind = User.find;
  const originalAuthAuditFind = AuthAudit.find;

  Firm.findById = () => ({ select: async () => ({ _id: 'firm-1', firmId: 'FIRM001', name: 'Acme' }) });
  User.find = () => ({
    select: () => ({
      sort: async () => ([
        { _id: 'admin-1', name: 'System Admin', email: 'system@acme.com', xID: 'X000001', status: 'ACTIVE', isSystem: true, lockUntil: null, passwordSetupTokenHash: 'x' },
        { _id: 'admin-2', name: 'Ops Admin', email: 'ops@acme.com', xID: 'X000002', status: 'INVITED', isSystem: false, lockUntil: new Date(Date.now() + 60000), passwordResetTokenHash: 'y' },
      ]),
    }),
  });
  AuthAudit.find = () => ({
    select: () => ({
      sort: async () => ([
        { userId: 'admin-2', timestamp: new Date('2026-02-20T10:00:00.000Z') },
      ]),
    }),
  });

  const req = baseReq();
  const res = createRes();
  await listFirmAdmins(req, res);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.data.length, 2);
  assert.strictEqual(res.body.data[0].emailMasked, 'sy***@acme.com');
  assert.strictEqual(res.body.data[1].emailMasked, 'op***@acme.com');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(res.body.data[0], 'passwordSetupTokenHash'), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(res.body.data[1], 'passwordResetTokenHash'), false);
  console.log('✓ GET firm admins returns masked fields and no token leakage');

  Firm.findById = originalFirmFindById;
  User.find = originalUserFind;
  AuthAudit.find = originalAuthAuditFind;
}

async function shouldCreateAdditionalAdmin() {
  const originalFirmFindById = Firm.findById;
  const originalUserFindOne = User.findOne;
  const originalUserSave = User.prototype.save;
  const originalGenerateNextXID = xIDGenerator.generateNextXID;
  const originalSendSetup = emailService.sendPasswordSetupEmail;
  const originalSuperadminAuditCreate = SuperadminAudit.create;

  let savedAdmin = null;
  let generatedXID = null;
  let auditAction = null;

  Firm.findById = async () => ({ _id: 'firm-1', firmId: 'FIRM001', name: 'Acme', firmSlug: 'acme', defaultClientId: 'client-1' });
  User.findOne = async () => null;
  xIDGenerator.generateNextXID = async () => {
    generatedXID = 'X000123';
    return generatedXID;
  };
  User.prototype.save = async function save() {
    savedAdmin = this;
    return this;
  };
  emailService.sendPasswordSetupEmail = async () => ({ success: true });
  SuperadminAudit.create = async (entry) => {
    auditAction = entry.actionType;
    return entry;
  };

  const req = baseReq();
  req.body = { name: 'John Doe', email: 'john@acme.com' };
  const res = createRes();
  await createFirmAdmin(req, res);

  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(savedAdmin.email, 'john@acme.com');
  assert.strictEqual(savedAdmin.status, 'INVITED');
  assert.strictEqual(savedAdmin.mustSetPassword, true);
  assert.strictEqual(savedAdmin.xID, generatedXID);
  assert.strictEqual(auditAction, 'AdminCreated');
  console.log('✓ POST create admin supports additional admins with invite lifecycle defaults');

  Firm.findById = originalFirmFindById;
  User.findOne = originalUserFindOne;
  User.prototype.save = originalUserSave;
  xIDGenerator.generateNextXID = originalGenerateNextXID;
  emailService.sendPasswordSetupEmail = originalSendSetup;
  SuperadminAudit.create = originalSuperadminAuditCreate;
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

async function shouldRejectDisableForLastActiveAdmin() {
  const originalFirmFindById = Firm.findById;
  const originalUserFindOne = User.findOne;
  const originalCountDocuments = User.countDocuments;

  Firm.findById = () => ({ select: async () => ({ _id: 'firm-1', firmId: 'FIRM001', name: 'Acme' }) });
  User.findOne = async () => ({
    _id: 'admin-1',
    xID: 'X000001',
    status: 'ACTIVE',
    mustSetPassword: false,
    isActive: true,
    save: async () => {},
  });
  User.countDocuments = async () => 1;

  const req = baseReq();
  req.body = { status: 'DISABLED' };
  const res = createRes();
  await updateFirmAdminStatus(req, res);
  assert.strictEqual(res.statusCode, 422);
  assert.strictEqual(res.body.code, 'LAST_ACTIVE_ADMIN');
  console.log('✓ PATCH admin status blocks disabling the last active admin');

  Firm.findById = originalFirmFindById;
  User.findOne = originalUserFindOne;
  User.countDocuments = originalCountDocuments;
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
  assert.strictEqual(adminSaved.mustChangePassword, true);
  assert.strictEqual(adminSaved.forcePasswordReset, true);
  console.log('✓ POST force-reset updates token lifecycle, emails admin, and audits action');

  Firm.findById = originalFirmFindById;
  User.findOne = originalUserFindOne;
  emailService.sendAdminPasswordResetEmail = originalSendReset;
  SuperadminAudit.create = originalSuperadminAuditCreate;
}

async function shouldDeleteAdminWithGuards() {
  const originalFirmFindById = Firm.findById;
  const originalUserFindOne = User.findOne;
  const originalCountDocuments = User.countDocuments;
  const originalDeleteOne = User.deleteOne;
  const originalSuperadminAuditCreate = SuperadminAudit.create;

  let deletedQuery = null;
  let auditAction = null;
  let callIndex = 0;

  Firm.findById = () => ({ select: async () => ({ _id: 'firm-1', firmId: 'FIRM001', name: 'Acme' }) });
  User.findOne = async () => {
    callIndex += 1;
    if (callIndex === 1) {
      return { _id: 'admin-system', xID: 'X000001', status: 'ACTIVE', isSystem: true };
    }
    return { _id: 'admin-2', xID: 'X000002', status: 'ACTIVE', isSystem: false, email: 'ops@acme.com' };
  };
  User.countDocuments = async () => 2;
  User.deleteOne = async (query) => {
    deletedQuery = query;
    return { deletedCount: 1 };
  };
  SuperadminAudit.create = async (entry) => {
    auditAction = entry.actionType;
    return entry;
  };

  const systemReq = baseReq();
  systemReq.params.adminId = '507f1f77bcf86cd799439012';
  const systemRes = createRes();
  await deleteFirmAdmin(systemReq, systemRes);
  assert.strictEqual(systemRes.statusCode, 422);
  assert.strictEqual(systemRes.body.code, 'SYSTEM_ADMIN_DELETE_FORBIDDEN');

  const deleteReq = baseReq();
  deleteReq.params.adminId = '507f1f77bcf86cd799439013';
  const deleteRes = createRes();
  await deleteFirmAdmin(deleteReq, deleteRes);
  assert.strictEqual(deleteRes.statusCode, 200);
  assert.strictEqual(deleteRes.body.success, true);
  assert.deepStrictEqual(deletedQuery, { _id: 'admin-2' });
  assert.strictEqual(auditAction, 'AdminDeleted');
  console.log('✓ DELETE admin blocks system admin and allows deleting non-system admin');

  Firm.findById = originalFirmFindById;
  User.findOne = originalUserFindOne;
  User.countDocuments = originalCountDocuments;
  User.deleteOne = originalDeleteOne;
  SuperadminAudit.create = originalSuperadminAuditCreate;
}

async function run() {
  try {
    await shouldViewFirmAdminDetailsSafely();
    await shouldListFirmAdminsMaskedWithoutTokens();
    await shouldCreateAdditionalAdmin();
    await shouldRejectInvalidAdminStatusTransitions();
    await shouldRejectDisableForLastActiveAdmin();
    await shouldForceResetOnlyForActiveAdminAndAudit();
    await shouldDeleteAdminWithGuards();
    console.log('\n✅ SuperAdmin admin lifecycle tests passed.');
    process.exit(0);
  } catch (error) {
    console.error('✗ SuperAdmin admin lifecycle test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

run();
