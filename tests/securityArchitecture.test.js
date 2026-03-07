#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Module = require('module');
const { encrypt, decrypt } = require('../src/utils/encryption');

function testEncryptionRoundTrip() {
  const originalKey = process.env.SECURITY_ENCRYPTION_KEY;
  process.env.SECURITY_ENCRYPTION_KEY = 'phase-3-security-key';

  try {
    const ciphertext = encrypt('BASE32SECRET2345');
    assert.notStrictEqual(ciphertext, 'BASE32SECRET2345', 'Ciphertext must differ from plaintext');
    assert.strictEqual(decrypt(ciphertext), 'BASE32SECRET2345', 'Decrypt must restore original MFA secret');
    assert.strictEqual(decrypt('legacy-plaintext-secret'), 'legacy-plaintext-secret', 'Legacy plaintext values must remain readable');
    const [prefix, payload] = ciphertext.split('::');
    const [iv, authTag, encryptedBody] = payload.split(':');
    const tamperedBody = `${encryptedBody.slice(0, -2)}AA`;
    const tampered = `${prefix}::${iv}:${authTag}:${tamperedBody}`;
    assert.throws(() => decrypt(tampered), /unable to authenticate data|Unsupported state|authenticate/i, 'Tampered ciphertext must fail authentication');
    console.log('  ✓ MFA secret encryption uses authenticated encryption');
  } finally {
    if (originalKey === undefined) delete process.env.SECURITY_ENCRYPTION_KEY;
    else process.env.SECURITY_ENCRYPTION_KEY = originalKey;
  }
}

async function testAuthorizationMiddleware() {
  const originalLoad = Module._load;
  let lastUserQuery = null;
  let lastCaseQuery = null;

  Module._load = function (request, parent, isMain) {
    if (request === '../models/User.model') {
      return {
        findOne: async (query) => {
          lastUserQuery = query;
          return { _id: '507f1f77bcf86cd799439011', role: 'Admin', firmId: query.firmId, isActive: true };
        },
      };
    }
    if (request === '../models/Case.model') {
      return {
        findOne: async (query) => {
          lastCaseQuery = query;
          return query.firmId === 'tenant-a' ? { _id: 'case-1', caseId: 'CASE-1', firmId: 'tenant-a' } : null;
        },
      };
    }
    if (request === '../utils/role.utils') {
      return { isSuperAdminRole: (role) => String(role).toUpperCase() === 'SUPERADMIN' };
    }
    return originalLoad.apply(this, arguments);
  };

  delete require.cache[require.resolve('../src/middleware/authorization.middleware')];
  const { requireTenant, requireAdmin, requireCaseAccess } = require('../src/middleware/authorization.middleware');

  try {
    const runMiddleware = async (middleware, req) => {
      const res = {
        statusCode: null,
        body: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(payload) {
          this.body = payload;
          return this;
        },
      };

      let nextCalled = false;
      await middleware(req, res, () => {
        nextCalled = true;
      });
      return { res, nextCalled };
    };

    const missingTenant = await runMiddleware(requireTenant, { user: { role: 'Admin' } });
    assert.strictEqual(missingTenant.res.statusCode, 400);
    assert.strictEqual(missingTenant.res.body.error, 'Tenant context missing. Request rejected.');

    const adminResult = await runMiddleware(requireAdmin, {
      tenant: { id: 'tenant-a' },
      user: { _id: '507f1f77bcf86cd799439011', role: 'Admin' },
    });
    assert.strictEqual(adminResult.nextCalled, true, 'Tenant admin should be allowed');
    assert.strictEqual(lastUserQuery.firmId, 'tenant-a', 'Admin guard must scope lookup by firmId');

    const caseGuard = requireCaseAccess();
    const caseResult = await runMiddleware(caseGuard, {
      firmId: 'tenant-a',
      params: { caseId: 'CASE-1' },
    });
    assert.strictEqual(caseResult.nextCalled, true, 'Tenant case access should pass for same-tenant case');
    assert.strictEqual(lastCaseQuery.firmId, 'tenant-a', 'Case guard must scope lookup by firmId');

    const deniedResult = await runMiddleware(caseGuard, {
      firmId: 'tenant-b',
      params: { caseId: 'CASE-1' },
    });
    assert.strictEqual(deniedResult.res.statusCode, 404, 'Cross-tenant access should be hidden behind 404');
    console.log('  ✓ Authorization middleware centralizes tenant/admin/case guards');
  } finally {
    Module._load = originalLoad;
    delete require.cache[require.resolve('../src/middleware/authorization.middleware')];
  }
}

async function testSecurityAuditAndTelemetry() {
  const originalLoad = Module._load;
  const auditEntries = [];
  const infoLogs = [];
  const warnLogs = [];

  Module._load = function (request, parent, isMain) {
    if (request === '../utils/log') {
      return {
        info: (event, meta) => infoLogs.push({ event, meta }),
        warn: (event, meta) => warnLogs.push({ event, meta }),
        error: () => {},
      };
    }
    if (request === './audit.service') {
      return {
        logAuthEvent: async (entry) => {
          auditEntries.push(entry);
          return entry;
        },
      };
    }
    if (request === './forensicAudit.service') {
      return {
        getRequestIp: (req) => req.ip || '127.0.0.1',
        getRequestUserAgent: (req) => req.headers?.['user-agent'] || 'agent',
      };
    }
    return originalLoad.apply(this, arguments);
  };

  delete require.cache[require.resolve('../src/services/securityAudit.service')];
  delete require.cache[require.resolve('../src/services/securityTelemetry.service')];
  const { logSecurityAuditEvent, SECURITY_AUDIT_ACTIONS } = require('../src/services/securityAudit.service');
  const telemetry = require('../src/services/securityTelemetry.service');

  try {
    await logSecurityAuditEvent({
      req: { ip: '127.0.0.1', headers: { 'user-agent': 'agent' }, user: { _id: '507f1f77bcf86cd799439011', xID: 'X000001', firmId: 'tenant-a' } },
      action: SECURITY_AUDIT_ACTIONS.LOGIN_SUCCESS,
      resource: 'auth/login',
      metadata: { token: 'secret-token', nested: { password: 'hidden' } },
    });

    assert.strictEqual(infoLogs[0].event, 'SECURITY_AUDIT');
    assert.strictEqual(infoLogs[0].meta.metadata.token, '[REDACTED]', 'Sensitive metadata must be redacted');
    assert.strictEqual(infoLogs[0].meta.metadata.nested.password, '[REDACTED]', 'Nested sensitive metadata must be redacted');

    telemetry._resetForTests();
    const req = { ip: '127.0.0.1', headers: { 'user-agent': 'agent' } };
    for (let i = 0; i < 5; i += 1) {
      await telemetry.noteLoginFailure({ req, xID: 'X999999', firmId: 'tenant-a' });
    }

    assert(warnLogs.some((entry) => entry.event === 'SECURITY_ALERT'), 'Telemetry must emit SECURITY_ALERT after repeated login failures');
    assert(auditEntries.some((entry) => entry.actionType === 'SECURITY_ALERT'), 'Security alerts must be persisted through audit service');
    console.log('  ✓ Security audit logging and telemetry emit structured alerts');
  } finally {
    telemetry._resetForTests();
    Module._load = originalLoad;
    delete require.cache[require.resolve('../src/services/securityAudit.service')];
    delete require.cache[require.resolve('../src/services/securityTelemetry.service')];
  }
}

async function run() {
  try {
    testEncryptionRoundTrip();
    await testAuthorizationMiddleware();
    await testSecurityAuditAndTelemetry();
    console.log('Security architecture tests passed.');
  } catch (error) {
    console.error('Security architecture tests failed:', error);
    process.exit(1);
  }
}

run();
