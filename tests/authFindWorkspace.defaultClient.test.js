'use strict';

const assert = require('assert');
const mongoose = require('mongoose');
const { findWorkspaceByXid } = require('../src/controllers/auth.controller');
const User = require('../src/models/User.model');
const Firm = require('../src/models/Firm.model');
const Client = require('../src/models/Client.model');

const defaultClientObjectId = new mongoose.Types.ObjectId();
const firmObjectId = new mongoose.Types.ObjectId();

const originalUserFind = User.find;
const originalFirmFind = Firm.find;
const originalClientFind = Client.find;

async function runTest() {
  // Test case 1: User whose firmId points to defaultClient (modern self-serve signup)
  User.find = () => ({
    select: () => ({
      lean: async () => [
        {
          _id: new mongoose.Types.ObjectId(),
          xID: 'X000001',
          firmId: defaultClientObjectId,
          defaultClientId: defaultClientObjectId,
          status: 'active',
          isActive: true,
        },
      ],
    }),
  });

  Firm.find = () => ({
    select: () => ({
      lean: async () => [
        {
          _id: firmObjectId,
          name: 'Sarvesh Firm',
          firmSlug: 'sarvesh-firm',
          defaultClientId: defaultClientObjectId,
          status: 'active',
        },
      ],
    }),
  });

  Client.find = () => ({
    select: () => ({
      lean: async () => [
        {
          _id: defaultClientObjectId,
          businessName: 'Sarvesh Firm',
          firmSlug: 'sarvesh-firm',
          isDefaultClient: true,
          status: 'ACTIVE',
        },
      ],
    }),
  });

  const req = { body: { xid: 'X000001' } };
  let responseStatus = 200;
  let responseData = null;
  const res = {
    status(code) {
      responseStatus = code;
      return this;
    },
    json(payload) {
      responseData = payload;
      return this;
    },
  };

  await findWorkspaceByXid(req, res);

  assert.strictEqual(responseStatus, 200);
  assert.strictEqual(responseData?.success, true);
  assert.strictEqual(Array.isArray(responseData?.data?.workspaces), true);
  assert.strictEqual(responseData.data.workspaces.length, 1);
  assert.strictEqual(responseData.data.workspaces[0].firmSlug, 'sarvesh-firm');
  assert.strictEqual(responseData.data.workspaces[0].firmName, 'Sarvesh Firm');

  // Test case 2: Invalid xID format fails closed
  let invalidRes = null;
  await findWorkspaceByXid({ body: { xid: 'invalid-xid' } }, {
    status() { return this; },
    json(payload) { invalidRes = payload; return this; },
  });
  assert.strictEqual(invalidRes?.success, true);
  assert.deepStrictEqual(invalidRes?.data?.workspaces, []);

  // Restore mocks
  User.find = originalUserFind;
  Firm.find = originalFirmFind;
  Client.find = originalClientFind;

  console.log('authFindWorkspace.defaultClient.test.js passed');
}

runTest().catch((err) => {
  User.find = originalUserFind;
  Firm.find = originalFirmFind;
  Client.find = originalClientFind;
  console.error(err);
  process.exit(1);
});
