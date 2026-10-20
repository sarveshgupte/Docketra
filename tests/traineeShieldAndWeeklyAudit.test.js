'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const {
  collectFirmWeeklyAuditLogs,
  generateAuditCsv,
  formatIst,
} = require('../src/services/weeklyAuditDigest.service');
const { restrictTraineeDownload } = require('../src/middleware/downloadShield.middleware');
const { normalizeFirmSettings } = require('../src/services/adminController.service');

test('Trainee Laptop Shield - User Override & Middleware Enforcement', async (t) => {
  await t.test('Junior staff with traineeLaptopShield = false is exempt and allowed to download', async () => {
    let nextCalled = false;
    let statusCode = null;

    const req = {
      user: {
        xID: 'X000004',
        role: 'USER',
        traineeLaptopShield: false, // Explicit exemption set by Primary Admin
        firmId: new mongoose.Types.ObjectId().toString(),
      },
      firm: {
        settings: {
          firm: {
            restrictTraineeDownloads: true, // Firm default is active
          },
        },
      },
    };

    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(payload) {
        return payload;
      },
    };

    await restrictTraineeDownload(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true, 'User with explicit traineeLaptopShield: false should bypass download restriction');
    assert.equal(statusCode, null, 'No error status code should be set');
  });

  await t.test('Junior staff with traineeLaptopShield = true is blocked even if firm default is false', async () => {
    let nextCalled = false;
    let statusCode = null;
    let responseBody = null;

    const req = {
      user: {
        xID: 'X000005',
        role: 'USER',
        traineeLaptopShield: true, // Explicit shield enabled for this user
        firmId: new mongoose.Types.ObjectId().toString(),
      },
      firm: {
        settings: {
          firm: {
            restrictTraineeDownloads: false, // Firm default is disabled
          },
        },
      },
    };

    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(payload) {
        responseBody = payload;
        return payload;
      },
    };

    await restrictTraineeDownload(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false, 'User with explicit traineeLaptopShield: true should be blocked');
    assert.equal(statusCode, 403, 'Should respond with 403 Forbidden');
    assert.equal(responseBody?.code, 'TRAINEE_DOWNLOAD_RESTRICTED');
  });

  await t.test('Junior staff with traineeLaptopShield = null inherits firm setting', async () => {
    let nextCalled = false;
    let statusCode = null;

    const req = {
      user: {
        xID: 'X000006',
        role: 'USER',
        traineeLaptopShield: null, // Inherits
        firmId: new mongoose.Types.ObjectId().toString(),
      },
      firm: {
        settings: {
          firm: {
            restrictTraineeDownloads: true,
          },
        },
      },
    };

    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(payload) {
        return payload;
      },
    };

    await restrictTraineeDownload(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false, 'Should be blocked because firm has restrictTraineeDownloads: true');
    assert.equal(statusCode, 403);
  });

  await t.test('Partners and Managers always bypass regardless of shield setting', async () => {
    for (const role of ['PRIMARY_ADMIN', 'ADMIN', 'MANAGER']) {
      let nextCalled = false;
      const req = {
        user: {
          xID: 'X000001',
          role,
          traineeLaptopShield: true, // Should not restrict partner/manager
        },
        firm: {
          settings: { firm: { restrictTraineeDownloads: true } },
        },
      };

      await restrictTraineeDownload(req, {}, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true, `${role} must bypass trainee laptop shield`);
    }
  });
});

test('Firm Settings Normalization - weeklyAuditDigestEnabled defaults to true', () => {
  const normalized = normalizeFirmSettings({});
  assert.equal(normalized.weeklyAuditDigestEnabled, true, 'weeklyAuditDigestEnabled should default to true');

  const disabled = normalizeFirmSettings({ weeklyAuditDigestEnabled: false });
  assert.equal(disabled.weeklyAuditDigestEnabled, false, 'weeklyAuditDigestEnabled can be set to false');
});

test('Weekly Audit Digest - CSV Generation and Formatting', () => {
  const sampleItems = [
    {
      timestamp: new Date('2026-10-15T10:30:00.000Z'),
      formattedTime: formatIst(new Date('2026-10-15T10:30:00.000Z')),
      category: 'Security Controls',
      action: 'TRAINEE SHIELD UPDATED',
      actor: 'CA Ramesh (X000001)',
      target: 'Trainee Aarti (X000005)',
      details: 'Trainee Laptop Shield updated to Enabled for staff X000005',
    },
    {
      timestamp: new Date('2026-10-14T08:15:00.000Z'),
      formattedTime: formatIst(new Date('2026-10-14T08:15:00.000Z')),
      category: 'Client Management',
      action: 'CLIENT CREATED',
      actor: 'Partner Suresh (X000002)',
      target: 'Shree Ganesh Traders (C000012)',
      details: 'Client registered: Shree Ganesh Traders',
    },
    {
      timestamp: new Date('2026-10-13T14:00:00.000Z'),
      formattedTime: formatIst(new Date('2026-10-13T14:00:00.000Z')),
      category: 'Firm Settings',
      action: 'FIRM SETTINGS UPDATED',
      actor: 'CA Ramesh (X000001)',
      target: 'Firm Configuration',
      details: 'Firm practice settings updated',
    },
  ];

  const csv = generateAuditCsv(sampleItems);
  assert.ok(csv.includes('"Timestamp","Category","Action","Performed By","Target","Details"'), 'CSV should contain standard headers');
  assert.ok(csv.includes('"Security Controls"'), 'CSV should include Security Controls entry');
  assert.ok(csv.includes('"TRAINEE SHIELD UPDATED"'), 'CSV should include TRAINEE SHIELD UPDATED entry');
  assert.ok(csv.includes('"CLIENT CREATED"'), 'CSV should include CLIENT CREATED entry');
  assert.ok(csv.includes('"FIRM SETTINGS UPDATED"'), 'CSV should include FIRM SETTINGS UPDATED entry');
  assert.ok(csv.includes('IST'), 'CSV timestamps should be formatted in IST');
});
