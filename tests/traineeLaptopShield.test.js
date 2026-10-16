#!/usr/bin/env node
'use strict';

const assert = require('assert');
const mongoose = require('mongoose');
const Firm = require('../src/models/Firm.model');
const { restrictTraineeDownload } = require('../src/middleware/downloadShield.middleware');
const { normalizeFirmSettings, DEFAULT_FIRM_SETTINGS } = require('../src/services/adminController.service');

const createMockRes = () => {
  return {
    statusCode: null,
    body: null,
    sent: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      this.sent = true;
      return this;
    },
  };
};

const runMiddleware = async (mw, req) => {
  const res = createMockRes();
  let nextCalled = false;
  await mw(req, res, () => {
    nextCalled = true;
  });
  return { res, nextCalled };
};

async function testNormalizeFirmSettings() {
  // Test defaults
  const defaults = normalizeFirmSettings({});
  assert.strictEqual(defaults.restrictTraineeDownloads, false, 'Default restrictTraineeDownloads must be false');

  // Test explicit boolean
  const enabled = normalizeFirmSettings({ restrictTraineeDownloads: true });
  assert.strictEqual(enabled.restrictTraineeDownloads, true, 'restrictTraineeDownloads=true must normalize to true');

  const disabled = normalizeFirmSettings({ restrictTraineeDownloads: false });
  assert.strictEqual(disabled.restrictTraineeDownloads, false, 'restrictTraineeDownloads=false must normalize to false');

  // Test traineeLaptopShield alias
  const aliasEnabled = normalizeFirmSettings({ traineeLaptopShield: true });
  assert.strictEqual(aliasEnabled.restrictTraineeDownloads, true, 'traineeLaptopShield=true must normalize to true');

  console.log('✔ normalizeFirmSettings tests passed');
}

async function testPartnersAndManagersAlwaysBypass() {
  const firmId = '507f1f77bcf86cd799439011';

  // PRIMARY_ADMIN with shield active
  const { nextCalled: paNext } = await runMiddleware(restrictTraineeDownload, {
    user: { _id: 'u1', xID: 'P001', role: 'PRIMARY_ADMIN', firmId },
    firm: { id: firmId, settings: { firm: { restrictTraineeDownloads: true } } },
  });
  assert.strictEqual(paNext, true, 'PRIMARY_ADMIN must bypass Trainee Laptop Shield');

  // ADMIN with shield active
  const { nextCalled: adminNext } = await runMiddleware(restrictTraineeDownload, {
    user: { _id: 'u2', xID: 'A001', role: 'ADMIN', firmId },
    firm: { id: firmId, settings: { firm: { restrictTraineeDownloads: true } } },
  });
  assert.strictEqual(adminNext, true, 'ADMIN must bypass Trainee Laptop Shield');

  // MANAGER with shield active
  const { nextCalled: mgrNext } = await runMiddleware(restrictTraineeDownload, {
    user: { _id: 'u3', xID: 'M001', role: 'MANAGER', firmId },
    firm: { id: firmId, settings: { firm: { restrictTraineeDownloads: true } } },
  });
  assert.strictEqual(mgrNext, true, 'MANAGER must bypass Trainee Laptop Shield');

  console.log('✔ Partner and Manager bypass tests passed');
}

async function testTraineeAllowedWhenShieldDisabled() {
  const firmId = '507f1f77bcf86cd799439011';

  // USER (Article Assistant) with shield disabled
  const { nextCalled, res } = await runMiddleware(restrictTraineeDownload, {
    user: { _id: 'u4', xID: 'T001', role: 'USER', firmId },
    firm: { id: firmId, settings: { firm: { restrictTraineeDownloads: false } } },
  });
  assert.strictEqual(nextCalled, true, 'Junior staff must be allowed when shield is disabled');
  assert.strictEqual(res.sent, false, 'No response should be sent when allowed');

  console.log('✔ Trainee allowed when shield disabled tests passed');
}

async function testTraineeBlockedWhenShieldEnabled() {
  const firmId = '507f1f77bcf86cd799439011';

  // USER (Article Assistant) with shield enabled via req.firm
  const { nextCalled: userNext, res: userRes } = await runMiddleware(restrictTraineeDownload, {
    user: { _id: 'u4', xID: 'T001', role: 'USER', firmId },
    firm: { id: firmId, settings: { firm: { restrictTraineeDownloads: true } } },
  });
  assert.strictEqual(userNext, false, 'Junior staff must NOT call next when shield is enabled');
  assert.strictEqual(userRes.statusCode, 403, 'Should return HTTP 403');
  assert.strictEqual(userRes.body.success, false, 'Should return success: false');
  assert.strictEqual(userRes.body.code, 'TRAINEE_DOWNLOAD_RESTRICTED', 'Should return code: TRAINEE_DOWNLOAD_RESTRICTED');
  assert.ok(userRes.body.message.includes('Trainee Laptop Shield is active'), 'Message must reference Trainee Laptop Shield');
  assert.ok(userRes.body.message.includes('in-app document preview'), 'Message must guide user to in-app document preview');

  // EMPLOYEE alias with shield enabled
  const { nextCalled: empNext, res: empRes } = await runMiddleware(restrictTraineeDownload, {
    user: { _id: 'u5', xID: 'T002', role: 'EMPLOYEE', firmId },
    firm: { id: firmId, settings: { firm: { restrictTraineeDownloads: true } } },
  });
  assert.strictEqual(empNext, false, 'EMPLOYEE must be blocked when shield is enabled');
  assert.strictEqual(empRes.statusCode, 403, 'EMPLOYEE should receive 403');
  assert.strictEqual(empRes.body.code, 'TRAINEE_DOWNLOAD_RESTRICTED');

  // STAFF alias with shield enabled
  const { nextCalled: staffNext, res: staffRes } = await runMiddleware(restrictTraineeDownload, {
    user: { _id: 'u6', xID: 'T003', role: 'STAFF', firmId },
    firm: { id: firmId, settings: { firm: { restrictTraineeDownloads: true } } },
  });
  assert.strictEqual(staffNext, false, 'STAFF must be blocked when shield is enabled');
  assert.strictEqual(staffRes.statusCode, 403, 'STAFF should receive 403');
  assert.strictEqual(staffRes.body.code, 'TRAINEE_DOWNLOAD_RESTRICTED');

  console.log('✔ Trainee blocked when shield enabled tests passed');
}

async function testDbFirmResolution() {
  const firmId = '507f1f77bcf86cd799439011';
  const originalReadyState = mongoose.connection.readyState;
  const originalFindById = Firm.findById;

  try {
    // Mock mongoose connected
    Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });

    // Mock Firm.findById returning restricted: true
    Firm.findById = (id) => ({
      select: () => ({
        lean: async () => ({
          _id: id,
          settings: { firm: { restrictTraineeDownloads: true } },
        }),
      }),
    });

    const { nextCalled, res } = await runMiddleware(restrictTraineeDownload, {
      user: { _id: 'u4', xID: 'T001', role: 'USER', firmId },
      // req.firm has no settings attached directly, forces DB lookup
      firm: { id: firmId },
    });

    assert.strictEqual(nextCalled, false, 'Should block junior staff after DB lookup');
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.body.code, 'TRAINEE_DOWNLOAD_RESTRICTED');

    // Now mock Firm.findById returning restricted: false
    Firm.findById = (id) => ({
      select: () => ({
        lean: async () => ({
          _id: id,
          settings: { firm: { restrictTraineeDownloads: false } },
        }),
      }),
    });

    const { nextCalled: nextCalled2 } = await runMiddleware(restrictTraineeDownload, {
      user: { _id: 'u4', xID: 'T001', role: 'USER', firmId },
      firm: { id: firmId },
    });

    assert.strictEqual(nextCalled2, true, 'Should allow junior staff when DB setting is false');

    console.log('✔ DB firm settings lookup tests passed');
  } finally {
    Object.defineProperty(mongoose.connection, 'readyState', { value: originalReadyState, configurable: true });
    Firm.findById = originalFindById;
  }
}

async function main() {
  try {
    await testNormalizeFirmSettings();
    await testPartnersAndManagersAlwaysBypass();
    await testTraineeAllowedWhenShieldDisabled();
    await testTraineeBlockedWhenShieldEnabled();
    await testDbFirmResolution();
    console.log('All Trainee Laptop Shield tests passed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Test failure:', error);
    process.exit(1);
  }
}

main();
