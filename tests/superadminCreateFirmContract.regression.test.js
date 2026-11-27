#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const schemas = require('../src/schemas/superadmin.routes.schema');

function testCreateFirmSchemaContract() {
  const schema = schemas['POST /firms'].body;
  assert.ok(schema, 'POST /firms schema must exist');

  const validUiPayload = schema.parse({
    firmName: 'Lex & Partners',
    adminName: 'Asha Rao',
    adminEmail: 'asha@lexpartners.in',
    name: 'Lex & Partners',
    slug: 'lex-partners',
  });
  assert.strictEqual(validUiPayload.firmName, 'Lex & Partners');

  const validLegacyPayload = schema.parse({ name: 'Acme Legal' });
  assert.strictEqual(validLegacyPayload.name, 'Acme Legal');

  assert.throws(() => schema.parse({ slug: 'missing-name' }), 'Should require firmName or name');
  assert.throws(() => schema.parse({ name: 'Acme', unexpectedKey: 'nope' }), 'Should reject unrecognized keys via .strict()');
}

async function testCreateFirmControllerDefaultClientAndAudit() {
  const originalLoad = Module._load;
  const recordedAudits = [];

  Module._load = function (request, parent, isMain) {
    if (request === 'bcrypt') {
      return { compare: async () => true, hash: async (v) => v };
    }
    if (request === '../modules/onboarding/onboarding.service') {
      return {
        createFirmWithAdmin: async (payload) => ({
          defaultClient: {
            _id: '65f000000000000000000101',
            clientId: 'C000101',
            firmSlug: 'lex-partners',
            businessName: payload.firmName,
            status: 'ACTIVE',
          },
          admin: {
            _id: '65f000000000000000000202',
            status: 'invited',
          },
        }),
      };
    }
    if (request === '../services/superadminLifecycle.service') {
      return {
        logSuperadminAction: async (entry) => {
          recordedAudits.push(entry);
        },
        findFirmAdmin: async () => null,
        findFirmAdminById: async () => null,
        isAdminCurrentlyLocked: () => false,
        normalizeAdminLifecycleStatus: (s) => s,
        isAdminDisabledStatus: () => false,
        resolveSessionQuery: (q) => Promise.resolve(q),
      };
    }
    if (request === '../middleware/wrapWriteHandler') {
      return (fn) => async (req, res, next) => {
        const result = await fn(req, res, next);
        return res.status(200).json(result);
      };
    }
    return originalLoad.apply(this, arguments);
  };

  try {
    const controllerPath = require.resolve('../src/controllers/superadmin.controller');
    delete require.cache[controllerPath];
    const { createFirm } = require('../src/controllers/superadmin.controller');

    const res = {
      statusCode: 200,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.body = payload; return this; },
    };

    await createFirm(
      {
        body: { name: 'Lex & Partners', adminName: 'Asha Rao', adminEmail: 'asha@lexpartners.in' },
        user: { _id: '000000000000000000000001', email: 'sa@test.com', xID: 'SUPERADMIN' },
        requestId: 'req-create-firm-1',
        ip: '127.0.0.1',
        headers: { 'user-agent': 'test-agent' },
      },
      res
    );

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.firmId, '65f000000000000000000101');
    assert.strictEqual(res.body.data.adminId, '65f000000000000000000202');

    const firmAudit = recordedAudits.find((entry) => entry.actionType === 'FirmCreated');
    assert.ok(firmAudit, 'createFirm must log FirmCreated event to SuperadminAudit');
    assert.strictEqual(firmAudit.targetEntityType, 'Firm');
    assert.strictEqual(firmAudit.targetEntityId, '65f000000000000000000101');
  } finally {
    Module._load = originalLoad;
  }
}

function testDashboardAndLayoutImprovements() {
  const dashboardSource = fs.readFileSync(path.resolve(__dirname, '../ui/src/pages/SuperadminDashboard.jsx'), 'utf8');
  const layoutSource = fs.readFileSync(path.resolve(__dirname, '../ui/src/components/common/SuperAdminLayout.jsx'), 'utf8');
  const clockSource = fs.readFileSync(path.resolve(__dirname, '../ui/src/components/superadmin/SuperadminLiveClock.jsx'), 'utf8');
  const pilotSurfaceSource = fs.readFileSync(path.resolve(__dirname, '../ui/src/constants/pilotSurface.js'), 'utf8');

  assert.ok(dashboardSource.includes('SuperadminLiveClock'), 'Dashboard should isolate ticking clock into SuperadminLiveClock');
  assert.ok(!dashboardSource.includes('setInterval('), 'Dashboard root must not run a 1-second re-render interval');
  assert.ok(clockSource.includes('setInterval('), 'SuperadminLiveClock should own the clock interval');
  assert.ok(dashboardSource.includes('useSearchParams'), 'Dashboard should sync active tab with URL query params');
  assert.ok(!dashboardSource.includes('w-3/4'), 'Dashboard must not contain fake hardcoded 75% User Footprint bar');
  assert.ok(!dashboardSource.includes('animate-ping'), 'Dashboard must avoid decorative animate-ping pulses');
  assert.ok(!dashboardSource.includes('animate-pulse'), 'Dashboard must avoid decorative animate-pulse effects');
  assert.ok(layoutSource.includes("event.key === 'Escape'"), 'SuperAdminLayout should dismiss search/menu on Escape');
  assert.ok(layoutSource.includes('Toggle navigation menu'), 'SuperAdminLayout should include mobile navigation toggle');
  assert.ok(pilotSurfaceSource.includes("'/app/superadmin/audit'"), 'SuperAdmin pilot nav should expose Audit Logs link');
}

(async () => {
  testCreateFirmSchemaContract();
  await testCreateFirmControllerDefaultClientAndAudit();
  testDashboardAndLayoutImprovements();
  console.log('superadminCreateFirmContract.regression.test.js passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
