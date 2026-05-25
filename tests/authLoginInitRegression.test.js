#!/usr/bin/env node
'use strict';

const assert = require('assert');
const bcrypt = require('bcrypt');

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.JWT_PASSWORD_SETUP_SECRET = process.env.JWT_PASSWORD_SETUP_SECRET || 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
process.env.SUPERADMIN_PASSWORD_HASH = process.env.SUPERADMIN_PASSWORD_HASH || '$2b$10$wioLOkqqceK.iu9MZavNOua7yV2AzOpqlR4fuMWHf2.YeYpV4mEFC';
process.env.SUPERADMIN_XID = process.env.SUPERADMIN_XID || 'X999999';
process.env.SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || 'superadmin@example.com';
process.env.SUPERADMIN_OBJECT_ID = process.env.SUPERADMIN_OBJECT_ID || '000000000000000000000001';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/docketra-test';

const User = require('../src/models/User.model');
const Firm = require('../src/models/Firm.model');
const LoginSession = require('../src/models/LoginSession.model');
const AuthAudit = require('../src/models/AuthAudit.model');
const AuditLog = require('../src/models/AuditLog.model');
const emailService = require('../src/services/email.service');
const { loginInit } = require('../src/controllers/auth.controller');

const createMockRes = () => {
  const body = {};
  const res = {
    statusCode: 200,
    headersSent: false,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.headersSent = true; Object.assign(body, payload); return this; },
    setHeader() { return this; },
    set() { return this; },
    cookie() { return this; },
    clearCookie() { return this; },
  };
  return { res, body };
};

const buildReq = (password) => ({
  method: 'POST',
  originalUrl: '/api/auth/login/init',
  body: { firmSlug: 'gupte-opc', xID: 'X000001', password },
  params: { firmSlug: 'gupte-opc' },
  firmId: '507f1f77bcf86cd799439022',
  firmSlug: 'gupte-opc',
  firm: { _id: '507f1f77bcf86cd799439022', status: 'active' },
  context: { firmId: '507f1f77bcf86cd799439022', firmSlug: 'gupte-opc' },
  loginScope: 'tenant',
  skipTransaction: true,
  ip: '127.0.0.1',
  get: () => 'test-agent',
});

async function shouldKeepFindOneAndUpdateMiddlewaresPromiseStyle() {
  const hooks = User.schema.s.hooks._pres.get('findOneAndUpdate') || [];
  const validatorHooks = hooks.filter((hook) => String(hook.fn).includes('assertHierarchyUpdatePayload'));
  assert(validatorHooks.length > 0, 'expected hierarchy guard findOneAndUpdate pre-hook to be registered');
  validatorHooks.forEach((hook) => {
    assert.strictEqual(hook.fn.length, 0, 'findOneAndUpdate hook must not declare callback next');
  });
}

async function shouldReturnControlledFailureForInvalidCredential() {
  const originals = {
    userFind: User.find,
    userFindOneAndUpdate: User.findOneAndUpdate,
    firmCountDocuments: Firm.countDocuments,
    loginSessionDeleteMany: LoginSession.deleteMany,
    loginSessionCreate: LoginSession.create,
    authAuditCreate: AuthAudit.create,
    auditLogCreate: AuditLog.create,
    sendLoginOtpEmail: emailService.sendLoginOtpEmail,
  };

  try {
    const user = {
      _id: { toString: () => '507f1f77bcf86cd799439011' },
      xID: 'X000001',
      xid: 'X000001',
      email: 'tenant@example.com',
      role: 'Employee',
      firmId: '507f1f77bcf86cd799439022',
      status: 'active',
      isActive: true,
      passwordHash: await bcrypt.hash('Correct#123', 4),
      failedLoginAttempts: 0,
      lockUntil: null,
      save: async function save() { return this; },
    };

    Firm.countDocuments = async () => 1;
    User.find = async () => [user];
    User.findOneAndUpdate = async () => user;
    LoginSession.deleteMany = async () => ({ deletedCount: 0 });
    LoginSession.create = async () => { throw new Error('should not create login session for invalid password'); };
    AuthAudit.create = async () => ({});
    AuditLog.create = async () => ({});
    emailService.sendLoginOtpEmail = async () => ({ success: true });

    const { res, body } = createMockRes();
    await loginInit(buildReq('Wrong#123'), res, () => {});

    assert.notStrictEqual(res.statusCode, 500, 'invalid credential path must not surface a 500');
    assert.strictEqual(body.success, false, 'invalid credential should remain a controlled failure');
  } finally {
    User.find = originals.userFind;
    User.findOneAndUpdate = originals.userFindOneAndUpdate;
    Firm.countDocuments = originals.firmCountDocuments;
    LoginSession.deleteMany = originals.loginSessionDeleteMany;
    LoginSession.create = originals.loginSessionCreate;
    AuthAudit.create = originals.authAuditCreate;
    AuditLog.create = originals.auditLogCreate;
    emailService.sendLoginOtpEmail = originals.sendLoginOtpEmail;
  }
}

async function run() {
  await shouldKeepFindOneAndUpdateMiddlewaresPromiseStyle();
  await shouldReturnControlledFailureForInvalidCredential();
  console.log('PASS auth login init regression guardrails');
}

run().catch((error) => {
  console.error('FAIL auth login init regression guardrails');
  console.error(error);
  process.exitCode = 1;
});
