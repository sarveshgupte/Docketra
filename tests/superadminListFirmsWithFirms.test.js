#!/usr/bin/env node
const assert = require('assert');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/docketra';
process.env.SUPERADMIN_XID = 'X123456';
process.env.SUPERADMIN_EMAIL = 'superadmin@example.com';
process.env.SUPERADMIN_PASSWORD_HASH = '$2b$10$' + 'a'.repeat(53);
process.env.SUPERADMIN_OBJECT_ID = '000000000000000000000001';
process.env.JWT_SECRET = 'x'.repeat(80);
process.env.ENCRYPTION_PROVIDER = 'disabled';

const firmPolicy = require('../src/policies/firm.policy');
const { listFirms, listFirmAdmins } = require('../src/controllers/superadmin.controller');
const Firm = require('../src/models/Firm.model');
const Client = require('../src/models/Client.model');
const User = require('../src/models/User.model');
const AuthAudit = require('../src/models/AuthAudit.model');

(async () => {
  console.log('Testing FirmPolicy role checks...');
  assert.strictEqual(firmPolicy.canView({ role: 'SuperAdmin' }), true, 'SuperAdmin should be allowed');
  assert.strictEqual(firmPolicy.canView({ role: 'SUPER_ADMIN' }), true, 'SUPER_ADMIN should be allowed');
  assert.strictEqual(firmPolicy.canView({ role: 'SUPERADMIN' }), true, 'SUPERADMIN should be allowed');
  assert.strictEqual(firmPolicy.canView({ role: 'superadmin' }), true, 'superadmin should be allowed');
  assert.strictEqual(firmPolicy.canView({ role: 'ADMIN' }), false, 'ADMIN should be denied');
  assert.strictEqual(firmPolicy.canView({ role: 'USER' }), false, 'USER should be denied');
  assert.strictEqual(firmPolicy.canView(null), false, 'null user should be denied');
  console.log('✓ FirmPolicy role checks passed');

  console.log('Testing listFirms with 2 firms in MongoDB (verifying no CastError)...');
  const firm1Id = new mongoose.Types.ObjectId();
  const firm1DefaultClientId = new mongoose.Types.ObjectId();
  const firm2Id = new mongoose.Types.ObjectId();
  const firm2DefaultClientId = new mongoose.Types.ObjectId();

  const mockFirms = [
    {
      _id: firm1Id,
      firmId: 'FIRM001',
      firmSlug: 'firm-one',
      name: 'Firm One CS',
      status: 'active',
      defaultClientId: firm1DefaultClientId,
      createdAt: new Date('2026-01-01'),
      plan: 'pilot',
      maxUsers: 10,
    },
    {
      _id: firm2Id,
      firmId: 'FIRM002',
      firmSlug: 'firm-two',
      name: 'Firm Two CA',
      status: 'active',
      defaultClientId: firm2DefaultClientId,
      createdAt: new Date('2026-01-02'),
      plan: 'pilot',
      maxUsers: 10,
    },
  ];

  // Save original methods
  const origFirmFind = Firm.find;
  const origClientAggregate = Client.aggregate;
  const origUserAggregate = User.aggregate;
  const origUserFind = User.find;

  let userFindFilter = null;

  Firm.find = () => ({
    select: () => ({
      sort: () => Promise.resolve(mockFirms),
    }),
  });

  Client.aggregate = async (pipeline) => {
    // Return sample counts
    return [
      { _id: firm1Id, count: 5 },
      { _id: firm2Id, count: 3 },
    ];
  };

  User.aggregate = async (pipeline) => {
    return [
      { _id: firm1Id, count: 4 },
      { _id: firm2Id, count: 2 },
    ];
  };

  // We test that User.find query does NOT throw a CastError with the real Mongoose User model casting
  User.find = (filter) => {
    userFindFilter = filter;
    // Actually invoke Mongoose casting on the filter to verify it does not throw CastError!
    const query = origUserFind.call(User, filter);
    query.cast(User);

    return {
      select: () => ({
        sort: () => ({
          lean: () => Promise.resolve([
            {
              _id: new mongoose.Types.ObjectId(),
              firmId: firm1Id,
              email: 'admin1@firmone.com',
              status: 'active',
              role: 'PRIMARY_ADMIN',
              isPrimaryAdmin: true,
              isSystem: true,
              createdAt: new Date('2026-01-01'),
            },
            {
              _id: new mongoose.Types.ObjectId(),
              firmId: firm2Id,
              email: 'admin2@firmtwo.com',
              status: 'active',
              role: 'PRIMARY_ADMIN',
              isPrimaryAdmin: true,
              isSystem: true,
              createdAt: new Date('2026-01-02'),
            },
          ]),
        }),
      }),
    };
  };

  const req = {
    user: { role: 'SUPERADMIN', xID: 'X123456' },
  };

  let jsonResult = null;
  let statusCode = 200;
  const res = {
    status: (code) => {
      statusCode = code;
      return res;
    },
    json: (data) => {
      jsonResult = data;
      return res;
    },
  };

  await listFirms(req, res);

  // Restore methods
  Firm.find = origFirmFind;
  Client.aggregate = origClientAggregate;
  User.aggregate = origUserAggregate;
  User.find = origUserFind;

  assert.strictEqual(statusCode, 200, `Expected status 200, got ${statusCode}`);
  assert.strictEqual(jsonResult?.success, true, 'listFirms should succeed');
  assert.strictEqual(jsonResult?.count, 2, 'listFirms should return 2 firms');
  assert.strictEqual(jsonResult?.data?.length, 2, 'listFirms data should have length 2');

  const f1 = jsonResult.data.find((f) => f.firmId === 'FIRM001');
  assert.ok(f1, 'Firm 1 should be in data');
  assert.strictEqual(f1.name, 'Firm One CS');
  assert.strictEqual(f1.adminEmail, 'admin1@firmone.com');
  assert.strictEqual(f1.clientCount, 5);
  assert.strictEqual(f1.userCount, 4);

  const f2 = jsonResult.data.find((f) => f.firmId === 'FIRM002');
  assert.ok(f2, 'Firm 2 should be in data');
  assert.strictEqual(f2.name, 'Firm Two CA');
  assert.strictEqual(f2.adminEmail, 'admin2@firmtwo.com');
  assert.strictEqual(f2.clientCount, 3);
  assert.strictEqual(f2.userCount, 2);

  // Verify that all keys in userFindFilter.firmId.$in are valid ObjectIds
  assert.ok(userFindFilter, 'User.find must have been called');
  assert.ok(userFindFilter.firmId?.$in, 'User.find must query firmId.$in');
  for (const key of userFindFilter.firmId.$in) {
    assert.strictEqual(
      mongoose.Types.ObjectId.isValid(key),
      true,
      `All tenant keys must be valid ObjectIds, got: ${key}`
    );
  }

  console.log('✓ listFirms successfully handled 2 firms without CastError and returned complete metadata');

  console.log('Testing listFirmAdmins with firm containing firmId string...');
  const origFirmFindById = Firm.findById;
  const origAuthAuditFind = AuthAudit.find;
  Firm.findById = () => ({
    select: () => Promise.resolve({
      _id: firm1Id,
      firmId: 'FIRM001',
      name: 'Firm One CS',
      defaultClientId: firm1DefaultClientId,
    }),
  });

  AuthAudit.find = () => ({
    select: () => ({
      sort: () => Promise.resolve([]),
    }),
  });

  let adminFindFilter = null;
  User.find = (filter) => {
    adminFindFilter = filter;
    const query = origUserFind.call(User, filter);
    query.cast(User);
    return {
      select: () => ({
        sort: () => Promise.resolve([]),
      }),
    };
  };

  const adminReq = {
    params: { firmId: firm1Id.toString() },
    user: { role: 'SUPERADMIN', xID: 'X123456' },
  };

  let adminJson = null;
  let adminStatus = 200;
  const adminRes = {
    status: (code) => {
      adminStatus = code;
      return adminRes;
    },
    json: (data) => {
      adminJson = data;
      return adminRes;
    },
  };

  await listFirmAdmins(adminReq, adminRes);

  Firm.findById = origFirmFindById;
  User.find = origUserFind;
  AuthAudit.find = origAuthAuditFind;

  assert.strictEqual(adminStatus, 200, `Expected 200, got ${adminStatus}`);
  assert.strictEqual(adminJson?.success, true);
  for (const key of adminFindFilter.firmId.$in) {
    assert.strictEqual(
      mongoose.Types.ObjectId.isValid(key),
      true,
      `All admin tenant keys must be valid ObjectIds, got: ${key}`
    );
  }
  console.log('✓ listFirmAdmins successfully executed without CastError');

  console.log('All tests passed in superadminListFirmsWithFirms.test.js');
})().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
