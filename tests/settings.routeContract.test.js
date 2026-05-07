#!/usr/bin/env node
'use strict';

/**
 * Settings Route Contract Test
 *
 * Validates route-guard and role-access contracts for all Settings pages:
 *   - Firm Settings  → GET /api/admin/firm-settings
 *   - Work Settings  → GET /api/admin/cms-intake-settings, GET /api/admin/workbaskets,
 *                      GET /api/settings/audit, GET /api/work-types
 *   - Storage        → GET /api/storage/configuration, GET /api/storage/ownership-summary
 *   - AI             → GET /api/ai/configuration
 *
 * Checks:
 *   - Authenticated users (PRIMARY_ADMIN / ADMIN) receive 200 for read endpoints
 *   - Unauthenticated requests receive 401
 *   - Write mutations are PRIMARY_ADMIN-only (ADMIN → 403)
 *
 * Note: secret masking and real response safety are proven against the REAL
 * controllers in tests/settingsControllerSafety.test.js.
 */

process.env.NODE_ENV = 'test';
process.env.UPLOAD_SCAN_STRICT = 'false';
process.env.JWT_SECRET = 'x'.repeat(80);
process.env.STORAGE_TOKEN_SECRET = 'y'.repeat(80);
process.env.METRICS_TOKEN = 'z'.repeat(80);
process.env.REDIS_URL = '';

const assert = require('assert');
const request = require('supertest');
const express = require('express');

// ── Module paths ────────────────────────────────────────────────────────────
const routeGroupsModulePath = require.resolve('../src/routes/routeGroups');
const permissionMiddlewareModulePath = require.resolve('../src/middleware/permission.middleware');
const authControllerModulePath = require.resolve('../src/controllers/auth.controller');
const adminControllerModulePath = require.resolve('../src/controllers/admin.controller');
const workbasketControllerModulePath = require.resolve('../src/controllers/workbasket.controller');
const workTypeControllerModulePath = require.resolve('../src/controllers/workType.controller');
const storageControllerModulePath = require.resolve('../src/controllers/storage.controller');
const aiControllerModulePath = require.resolve('../src/controllers/ai.controller');
const settingsAuditControllerModulePath = require.resolve('../src/controllers/settingsAudit.controller');

// ── Swap helper ──────────────────────────────────────────────────────────────
const restore = [];
const swapModule = (modulePath, exportsValue) => {
  restore.push({ modulePath, original: require.cache[modulePath] });
  delete require.cache[modulePath];
  require.cache[modulePath] = { id: modulePath, filename: modulePath, loaded: true, exports: exportsValue };
};

// ── Main test ────────────────────────────────────────────────────────────────
(async () => {
  // Generic ok handler used for write/mutation endpoints
  const ok = (_req, res) => res.status(200).json({ success: true });

  // Auth gate: injects req.user based on x-test-role, requires Bearer token
  const authGate = (req, res, next) => {
    const authHeader = String(req.headers.authorization || '');
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'missing_token' });
    }
    const role = String(req.headers['x-test-role'] || 'PRIMARY_ADMIN').toUpperCase();
    req.user = {
      _id: '507f1f77bcf86cd799439012',
      xID: 'X000001',
      role,
      firmId: '507f1f77bcf86cd799439011',
    };
    return next();
  };

  // Tenant gate: injects req.firm, req.firmId; rejects missing-context header
  const tenantGate = (req, res, next) => {
    if (req.headers['x-test-missing-firm-context'] === '1') {
      return res.status(403).json({ success: false, message: 'Firm context is required' });
    }
    req.firm = { id: '507f1f77bcf86cd799439011', _id: '507f1f77bcf86cd799439011', firmSlug: 'acme' };
    req.firmId = '507f1f77bcf86cd799439011';
    return next();
  };

  // ── Module mocks ──────────────────────────────────────────────────────────

  // routeGroups: flatten all access groups to [authGate, tenantGate]
  swapModule(routeGroupsModulePath, {
    firmAuthenticatedAccess: [authGate, tenantGate],
    firmReadAccess: [authGate, tenantGate],
    firmWriteAccess: [authGate, tenantGate],
    firmSensitiveAccess: [authGate, tenantGate],
    adminBaseAccess: [authGate, tenantGate],
    tenantScopedApiAccess: [authGate, tenantGate, (_req, _res, next) => next()],
    adminTenantScopedApiAccess: [
      authGate,
      tenantGate,
      (_req, _res, next) => next(),
      (_req, _res, next) => next(),
      (_req, _res, next) => next(),
    ],
  });

  // permission.middleware: pass-through for authorizeFirmPermission
  const originalPermission = require(permissionMiddlewareModulePath);
  swapModule(permissionMiddlewareModulePath, {
    ...originalPermission,
    requireAdmin: (req, res, next) => ['PRIMARY_ADMIN', 'ADMIN'].includes(String(req.user?.role || '').toUpperCase())
      ? next()
      : res.status(403).json({ success: false, message: 'Admin role required' }),
    authorizeFirmPermission: () => (_req, _res, next) => next(),
  });

  // auth.controller mock
  swapModule(authControllerModulePath, new Proxy(
    { getAllUsers: (_req, res) => res.status(200).json({ success: true, data: [] }) },
    { get: (target, prop) => target[prop] || ok },
  ));

  // Safe mock responses that match the real response shapes but contain no secrets
  const FIRM_SETTINGS_RESPONSE = {
    success: true,
    data: {
      firm: { name: '', timezone: 'UTC', currency: 'USD', primaryLanguage: 'en', features: {} },
      work: { defaultPriority: 'MEDIUM', maxActiveDockets: 0, autoAssign: false },
    },
  };

  const CMS_INTAKE_RESPONSE = {
    success: true,
    data: {
      intake: {
        autoCreateClient: true,
        autoCreateDocket: true,
        defaultCategoryId: null,
        defaultSubcategoryId: null,
        defaultWorkbasketId: null,
        defaultPriority: null,
        defaultAssignee: null,
        intakeApiEnabled: false,
        intakeApiKeyMasked: '••••••••',
        // intakeApiKey plaintext-leak check is proven against the real controller in
        // tests/settingsControllerSafety.test.js (test 2: admin.getCmsIntakeSettings)
      },
      options: {
        workbaskets: [],
        categories: [],
        priorities: ['LOW', 'MEDIUM', 'HIGH'],
        assignees: [],
      },
    },
  };

  const SETTINGS_AUDIT_RESPONSE = {
    success: true,
    data: [],
    pagination: { page: 1, limit: 50, total: 0 },
  };

  swapModule(adminControllerModulePath, new Proxy({
    getFirmSettings: (_req, res) => res.status(200).json(FIRM_SETTINGS_RESPONSE),
    getCmsIntakeSettings: (_req, res) => res.status(200).json(CMS_INTAKE_RESPONSE),
    getSettingsAudit: (_req, res) => res.status(200).json(SETTINGS_AUDIT_RESPONSE),
    getFirmSettingsActivity: (_req, res) => res.status(200).json({ success: true, data: [] }),
    updateFirmSettings: ok,
    updateCmsIntakeSettings: ok,
    regenerateCmsIntakeApiKey: ok,
    getStorageConfig: (_req, res) => res.status(200).json({ success: true, data: { provider: 'docketra_managed', status: 'ACTIVE_MANAGED' } }),
    updateStorageConfig: ok,
    disconnectStorage: ok,
    getAdminStats: (_req, res) => res.status(200).json({ success: true, data: {} }),
    getHierarchyTree: (_req, res) => res.status(200).json({ success: true, data: [] }),
    getAdminAuditLogs: (_req, res) => res.status(200).json({ success: true, data: [] }),
    getRetentionPreview: ok,
    getSystemDiagnostics: ok,
    resendInviteEmail: ok,
    getAllOpenCases: ok,
    getAllPendingCases: ok,
    getAllFiledCases: ok,
    getAllResolvedCases: ok,
    restoreUser: ok,
    restoreClient: ok,
    restoreCase: ok,
    restoreTask: ok,
  }, { get: (target, prop) => target[prop] || ok }));

  swapModule(workbasketControllerModulePath, {
    listWorkbaskets: (_req, res) => res.status(200).json({ success: true, data: [] }),
    createWorkbasket: ok,
    renameWorkbasket: ok,
    toggleWorkbasketStatus: ok,
    updateUserWorkbaskets: ok,
    createDefaultRouting: ok,
    addQcMember: ok,
  });

  swapModule(workTypeControllerModulePath, {
    listWorkTypes: (_req, res) => res.status(200).json({ success: true, data: [] }),
    createWorkType: ok,
    createSubWorkType: ok,
    updateWorkTypeStatus: ok,
  });

  swapModule(settingsAuditControllerModulePath, {
    getSettingsAudit: (_req, res) => res.status(200).json(SETTINGS_AUDIT_RESPONSE),
  });

  // Storage: no refreshToken / accessToken / clientSecret / secretAccessKey in response
  const STORAGE_CONFIG_RESPONSE = {
    provider: 'docketra_managed',
    isConfigured: false,
    status: 'ACTIVE_MANAGED',
    connectedEmail: null,
    rootFolderId: null,
    driveId: null,
    warnings: ['Firm-owned BYOS is recommended but not required.'],
    folderPath: null,
    createdAt: null,
    updatedAt: null,
    backup: {
      enabled: false,
      notificationRecipients: [],
      deliveryPolicy: 'link_only',
      retentionDays: 30,
    },
  };

  const STORAGE_OWNERSHIP_RESPONSE = {
    activeStorage: { provider: 'docketra_managed', mode: 'managed', connectionStatus: 'ACTIVE_MANAGED', connectedEmail: null },
    lastHealthCheck: { checkedAt: null, status: 'ACTIVE_MANAGED', lastError: null },
    fallbackStorage: { provider: 'docketra_managed', enabled: true, status: 'ACTIVE_MANAGED' },
    backupExport: { backupEnabled: false, retentionDays: 30, lastExport: null },
    ownershipModel: 'Docketra uses a control-plane model.',
    warnings: [],
  };

  swapModule(storageControllerModulePath, new Proxy({
    getStorageConfiguration: (_req, res) => res.status(200).json(STORAGE_CONFIG_RESPONSE),
    getStorageOwnershipSummary: (_req, res) => res.status(200).json(STORAGE_OWNERSHIP_RESPONSE),
    testStorageConnection: ok,
    exportFirmStorage: ok,
    listBackupRuns: ok,
    disconnectStorage: ok,
    getStorageStatus: ok,
    getStorageHealth: ok,
    googleConnect: ok,
    googleCallback: ok,
    googleConfirmDrive: ok,
    storageHealthCheck: ok,
    storageUsage: ok,
    downloadFirmStorageExport: ok,
  }, { get: (target, prop) => target[prop] || ok }));

  // AI: no apiKey / encryptedKey in response
  const AI_CONFIG_RESPONSE = {
    success: true,
    configuration: {
      enabled: false,
      provider: 'disabled',
      model: '',
      credentialMode: 'none',
      hasEncryptedKey: false,
      hasCredentialRef: false,
      features: {},
      roleAccess: {},
      retention: {},
      privacy: {},
    },
  };

  swapModule(aiControllerModulePath, new Proxy({
    getAiConfiguration: (_req, res) => res.status(200).json(AI_CONFIG_RESPONSE),
    updateAiConfiguration: ok,
    testAiConfiguration: ok,
  }, { get: (target, prop) => target[prop] || ok }));

  // ── Load routes AFTER module swaps ─────────────────────────────────────────
  delete require.cache[require.resolve('../src/routes/admin.routes')];
  delete require.cache[require.resolve('../src/routes/storage.routes')];
  delete require.cache[require.resolve('../src/routes/ai.routes')];
  delete require.cache[require.resolve('../src/routes/workType.routes')];
  delete require.cache[require.resolve('../src/routes/settings.routes')];

  const adminRoutes = require('../src/routes/admin.routes');
  const storageRoutes = require('../src/routes/storage.routes');
  const aiRoutes = require('../src/routes/ai.routes');
  const workTypeRoutes = require('../src/routes/workType.routes');
  const settingsRoutes = require('../src/routes/settings.routes');

  // ── Build minimal test app ─────────────────────────────────────────────────
  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRoutes);
  app.use('/api/storage', authGate, tenantGate, storageRoutes);
  app.use('/api/ai', authGate, tenantGate, aiRoutes);
  app.use('/api/work-types', authGate, tenantGate, workTypeRoutes);
  app.use('/api/settings', authGate, tenantGate, settingsRoutes);

  // ══════════════════════════════════════════════════════════════════════════
  // 1. READ ENDPOINTS — PRIMARY_ADMIN and ADMIN both receive 200
  // ══════════════════════════════════════════════════════════════════════════

  // Endpoints that wrap response in { success: true, ... }
  const successWrappedEndpoints = [
    '/api/admin/firm-settings',
    '/api/admin/cms-intake-settings',
    '/api/admin/settings/audit',
    '/api/settings/audit',
    '/api/work-types',
    '/api/ai/configuration',
  ];

  // Endpoints that return config objects directly (no success wrapper)
  const rawConfigEndpoints = [
    '/api/storage/configuration',
    '/api/storage/ownership-summary',
  ];

  const allReadEndpoints = [...successWrappedEndpoints, ...rawConfigEndpoints];

  for (const role of ['PRIMARY_ADMIN', 'ADMIN']) {
    for (const endpoint of allReadEndpoints) {
      const res = await request(app)
        .get(endpoint)
        .set('Authorization', 'Bearer valid')
        .set('x-test-role', role);
      assert.strictEqual(
        res.status,
        200,
        `${role} GET ${endpoint} expected 200, got ${res.status} body=${JSON.stringify(res.body)}`,
      );
    }

    for (const endpoint of successWrappedEndpoints) {
      const res = await request(app)
        .get(endpoint)
        .set('Authorization', 'Bearer valid')
        .set('x-test-role', role);
      assert.strictEqual(
        res.body?.success,
        true,
        `${role} GET ${endpoint} expected success:true, got ${JSON.stringify(res.body)}`,
      );
    }
  }

  // MANAGER may read AI config (route policy: requireRole(['PRIMARY_ADMIN', 'ADMIN', 'MANAGER']))
  const managerAiRes = await request(app)
    .get('/api/ai/configuration')
    .set('Authorization', 'Bearer valid')
    .set('x-test-role', 'MANAGER');
  assert.strictEqual(managerAiRes.status, 200, 'MANAGER GET /api/ai/configuration should return 200');

  // ══════════════════════════════════════════════════════════════════════════
  // 2. UNAUTHENTICATED REQUESTS → 401
  // ══════════════════════════════════════════════════════════════════════════
  for (const endpoint of ['/api/admin/firm-settings', '/api/storage/configuration', '/api/ai/configuration']) {
    const res = await request(app).get(endpoint);
    assert.strictEqual(res.status, 401, `Unauthenticated GET ${endpoint} should return 401`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 3. WRITE PROTECTION — ADMIN blocked by requirePrimaryAdmin
  // ══════════════════════════════════════════════════════════════════════════
  const writeEndpoints = [
    ['put', '/api/admin/firm-settings'],
    ['put', '/api/admin/storage'],
    ['put', '/api/ai/configuration'],
  ];

  for (const [method, endpoint] of writeEndpoints) {
    // ADMIN must be blocked with 403
    const adminRes = await request(app)
      [method](endpoint)
      .set('Authorization', 'Bearer valid')
      .set('x-test-role', 'ADMIN')
      .send({});
    assert.strictEqual(
      adminRes.status,
      403,
      `ADMIN ${method.toUpperCase()} ${endpoint} expected 403, got ${adminRes.status}`,
    );
    assert.strictEqual(
      adminRes.body?.message,
      'Primary admin access required',
      `ADMIN ${method.toUpperCase()} ${endpoint} must return Primary admin access required`,
    );

    // PRIMARY_ADMIN must pass the route guard (controller returns 200 from mock)
    const primaryAdminRes = await request(app)
      [method](endpoint)
      .set('Authorization', 'Bearer valid')
      .set('x-test-role', 'PRIMARY_ADMIN')
      .send({});
    assert.notStrictEqual(
      primaryAdminRes.status,
      403,
      `PRIMARY_ADMIN ${method.toUpperCase()} ${endpoint} must not be blocked by 403`,
    );
  }

  // POST /api/admin/cms-intake-settings/intake-api-key/regenerate is PRIMARY_ADMIN-only
  const regenerateAdminRes = await request(app)
    .post('/api/admin/cms-intake-settings/intake-api-key/regenerate')
    .set('Authorization', 'Bearer valid')
    .set('x-test-role', 'ADMIN')
    .send({});
  assert.strictEqual(regenerateAdminRes.status, 403, 'ADMIN POST cms-intake-settings/regenerate should be 403');

  const regeneratePrimaryRes = await request(app)
    .post('/api/admin/cms-intake-settings/intake-api-key/regenerate')
    .set('Authorization', 'Bearer valid')
    .set('x-test-role', 'PRIMARY_ADMIN')
    .send({});
  assert.notStrictEqual(regeneratePrimaryRes.status, 403, 'PRIMARY_ADMIN POST cms-intake-settings/regenerate must pass');

  console.log('settings.routeContract.test.js passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(() => {
  for (const { modulePath, original } of restore) {
    delete require.cache[modulePath];
    if (original) require.cache[modulePath] = original;
  }
  for (const modulePath of [
    require.resolve('../src/routes/admin.routes'),
    require.resolve('../src/routes/storage.routes'),
    require.resolve('../src/routes/ai.routes'),
    require.resolve('../src/routes/workType.routes'),
    require.resolve('../src/routes/settings.routes'),
  ]) {
    delete require.cache[modulePath];
  }
});
