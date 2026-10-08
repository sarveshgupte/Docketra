#!/usr/bin/env node
process.env.NODE_ENV = 'test';
const assert = require('assert');
const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');

// --- Unit Verification: user.controller.updateUser ---
const userRepository = require('../src/repositories/user.repository');
const { updateUser } = require('../src/controllers/user.controller');

(async () => {
  console.log('🧪 Testing Task 1: updateUser privilege escalation seal...');

  let savedUser = null;
  const originalFindUserById = userRepository.findUserById;
  try {
    userRepository.findUserById = async (id, firmId) => {
      if (id === 'target-user') {
        savedUser = {
          _id: new mongoose.Types.ObjectId(),
          xID: 'X100001',
          name: 'Original Name',
          role: 'USER',
          isActive: true,
          firmId,
          save: async function() { return this; },
          toSafeObject: function() { return { ...this }; },
        };
        return savedUser;
      }
      if (id === 'primary-admin-user') {
        savedUser = {
          _id: new mongoose.Types.ObjectId(),
          xID: 'X000001',
          name: 'Primary Admin',
          role: 'PRIMARY_ADMIN',
          isPrimaryAdmin: true,
          isActive: true,
          firmId,
          save: async function() { return this; },
          toSafeObject: function() { return { ...this }; },
        };
        return savedUser;
      }
      return null;
    };

    const createRes = () => ({
      statusCode: 200,
      body: null,
      status(c) { this.statusCode = c; return this; },
      json(b) { this.body = b; return this; },
    });

    // 1. Attempt role escalation to PRIMARY_ADMIN via PUT /api/users/:id
    const req1 = {
      params: { id: 'target-user' },
      user: { _id: 'admin-actor', role: 'ADMIN', firmId: new mongoose.Types.ObjectId() },
      body: { name: 'New Name', role: 'PRIMARY_ADMIN' },
      skipTransaction: true,
    };
    const res1 = createRes();
    await updateUser(req1, res1);

    assert.strictEqual(res1.statusCode, 200);
    assert.strictEqual(savedUser.name, 'New Name', 'Name should be updated');
    assert.strictEqual(savedUser.role, 'USER', 'Role must NOT be modified via updateUser');

    // 2. Attempt role escalation to SUPER_ADMIN via PUT /api/users/:id
    const req2 = {
      params: { id: 'target-user' },
      user: { _id: 'admin-actor', role: 'ADMIN', firmId: req1.user.firmId },
      body: { role: 'SUPER_ADMIN' },
      skipTransaction: true,
    };
    const res2 = createRes();
    await updateUser(req2, res2);

    assert.strictEqual(res2.statusCode, 200);
    assert.strictEqual(savedUser.role, 'USER', 'Role must remain USER even when SUPER_ADMIN is requested');

    // 3. Attempt to deactivate Primary Admin via PUT /api/users/:id
    const req3 = {
      params: { id: 'primary-admin-user' },
      user: { _id: 'admin-actor', role: 'ADMIN', firmId: req1.user.firmId },
      body: { isActive: false },
      skipTransaction: true,
    };
    const res3 = createRes();
    await updateUser(req3, res3);

    assert.strictEqual(res3.statusCode, 403, 'Deactivating primary admin must be rejected with 403');
    assert.strictEqual(savedUser.isActive, true, 'Primary admin isActive must remain true');

    console.log('✅ Task 1 (user.controller.updateUser) tests passed.');
  } finally {
    userRepository.findUserById = originalFindUserById;
  }

  // --- Integration Verification: invoice.routes.js RBAC & client deny-list ---
  console.log('🧪 Testing Task 2: invoice routes RBAC and client deny-list...');

  const User = require('../src/models/User.model');
  const Invoice = require('../src/models/Invoice.model');
  const Client = require('../src/models/Client.model');
  const CrmClient = require('../src/models/CrmClient.model');
  const invoiceRoutes = require('../src/routes/invoice.routes');

  const firmId = new mongoose.Types.ObjectId();
  const allowedClientObjId = new mongoose.Types.ObjectId();
  const restrictedClientObjId = new mongoose.Types.ObjectId();
  const allowedCrmId = new mongoose.Types.ObjectId();
  const restrictedCrmId = new mongoose.Types.ObjectId();

  const originalUserFindOne = User.findOne;
  const originalClientFind = Client.find;
  const originalClientFindOne = Client.findOne;
  const originalCrmFind = CrmClient.find;
  const originalCrmFindOne = CrmClient.findOne;
  const originalInvoiceFind = Invoice.find;
  const originalInvoiceFindOne = Invoice.findOne;
  const originalInvoiceCreate = Invoice.create;

  let currentTestUser = null;

  try {
    User.findOne = async () => {
      if (!currentTestUser) return null;
      return {
        _id: currentTestUser._id,
        xID: currentTestUser.xID,
        role: currentTestUser.role,
        isActive: true,
        firmId: currentTestUser.firmId,
        permissions: [],
      };
    };

    Client.find = (filter) => ({
      select: () => ({
        lean: async () => {
          if (filter.clientId?.$in?.includes('C_RESTRICTED')) {
            return [{ _id: restrictedClientObjId, legacyCrmClientId: restrictedCrmId, clientId: 'C_RESTRICTED' }];
          }
          return [];
        },
      }),
    });

    const makeMockQuery = (doc) => ({
      select() { return this; },
      session() { return this; },
      lean: async () => doc,
      then(resolve, reject) { return Promise.resolve(doc).then(resolve, reject); },
    });

    CrmClient.find = (filter) => ({
      select: () => ({
        lean: async () => {
          if (filter.$or) {
            return [{ _id: restrictedCrmId, canonicalClientId: restrictedClientObjId }];
          }
          return [];
        },
      }),
    });

    CrmClient.findOne = (filter) => {
      let doc = null;
      if (filter) {
        if (String(filter._id) === String(restrictedCrmId) || String(filter.canonicalClientId) === String(restrictedClientObjId)) {
          doc = { _id: restrictedCrmId, canonicalClientId: restrictedClientObjId };
        } else {
          doc = { _id: allowedCrmId, canonicalClientId: allowedClientObjId };
        }
      }
      return makeMockQuery(doc);
    };

    Client.findOne = (filter) => {
      let doc = null;
      if (filter?.isDefaultClient) {
        doc = { _id: firmId, firmId, firmSlug: 'test-firm', businessName: 'Test Firm', status: 'active' };
      } else if (
        String(filter?._id) === String(restrictedClientObjId) ||
        filter?.$or?.some(c => String(c._id) === String(restrictedClientObjId) || String(c.legacyCrmClientId) === String(restrictedCrmId))
      ) {
        doc = { _id: restrictedClientObjId, clientId: 'C_RESTRICTED', legacyCrmClientId: restrictedCrmId, save: async () => {} };
      } else {
        doc = { _id: allowedClientObjId, clientId: 'C_ALLOWED', legacyCrmClientId: allowedCrmId, save: async () => {} };
      }
      return makeMockQuery(doc);
    };

    Client.updateOne = async () => ({ acknowledged: true });
    CrmClient.updateOne = async () => ({ acknowledged: true });

    let lastInvoiceQuery = null;
    Invoice.find = (query) => {
      lastInvoiceQuery = query;
      return {
        sort: () => ({
          skip: () => ({
            limit: () => ({
              lean: async () => [
                { _id: new mongoose.Types.ObjectId(), clientId: allowedCrmId, amount: 500, status: 'unpaid' },
              ],
            }),
          }),
        }),
      };
    };

    Invoice.create = async (doc) => ({ _id: new mongoose.Types.ObjectId(), ...doc });

    // Build test express app simulating tenantScopedApiAccess + invoiceRoutes
    const app = express();
    app.use(express.json());

    // Inject mock user context based on headers
    app.use((req, _res, next) => {
      const role = req.headers['x-role'] || 'ADMIN';
      const restricted = req.headers['x-restricted'] ? req.headers['x-restricted'].split(',') : [];
      req.user = {
        _id: new mongoose.Types.ObjectId(),
        xID: 'X100001',
        role,
        firmId,
        restrictedClientIds: restricted,
      };
      currentTestUser = req.user;
      req.firm = { id: String(firmId) };
      req.firmId = String(firmId);
      req.skipTransaction = true;
      next();
    });

    app.use('/api/invoices', invoiceRoutes);

    // 1. GET /api/invoices as USER (Staff) -> Allowed (has CLIENT_VIEW)
    const getResStaff = await request(app)
      .get('/api/invoices')
      .set('x-role', 'USER');
    assert.strictEqual(getResStaff.status, 200, 'USER role should be able to view invoices (CLIENT_VIEW)');

    // 2. GET /api/invoices with client restrictions -> Excludes restricted client
    const getResRestricted = await request(app)
      .get('/api/invoices')
      .set('x-role', 'USER')
      .set('x-restricted', 'C_RESTRICTED');
    assert.strictEqual(getResRestricted.status, 200);
    assert.ok(lastInvoiceQuery.clientId?.$nin, 'Query must include $nin for restricted clients');
    assert.ok(
      lastInvoiceQuery.clientId.$nin.some(id => String(id) === String(restrictedCrmId)),
      'Restricted CrmClient ID must be in $nin list'
    );

    // 3. POST /api/invoices as USER (Staff) -> Forbidden (lacks CLIENT_MANAGE)
    const postResStaff = await request(app)
      .post('/api/invoices')
      .set('x-role', 'USER')
      .send({ clientId: String(allowedClientObjId), amount: 100, description: 'Consulting' });
    assert.strictEqual(postResStaff.status, 403, 'USER should be forbidden from creating invoices');

    // 4. POST /api/invoices as ADMIN -> Allowed for non-restricted client
    const postResAdmin = await request(app)
      .post('/api/invoices')
      .set('x-role', 'ADMIN')
      .send({ clientId: String(allowedClientObjId), amount: 100, description: 'Audit' });
    assert.strictEqual(postResAdmin.status, 201, 'ADMIN should be allowed to create invoice for permitted client');

    // 5. POST /api/invoices for restricted client -> 403
    const postResBlockedClient = await request(app)
      .post('/api/invoices')
      .set('x-role', 'ADMIN')
      .set('x-restricted', 'C_RESTRICTED')
      .send({ clientId: String(restrictedClientObjId), amount: 200, description: 'Tax filing' });
    assert.strictEqual(postResBlockedClient.status, 403, 'Creating invoice for restricted client must return 403');
    assert.strictEqual(postResBlockedClient.body.code, 'CLIENT_ACCESS_RESTRICTED');

    // 6. PATCH /api/invoices/:id/paid as USER -> Forbidden (lacks CLIENT_MANAGE)
    const patchResStaff = await request(app)
      .patch(`/api/invoices/${new mongoose.Types.ObjectId()}/paid`)
      .set('x-role', 'USER')
      .send({});
    assert.strictEqual(patchResStaff.status, 403, 'USER should be forbidden from marking invoice paid');

    // 7. PATCH /api/invoices/:id/paid as ADMIN -> Allowed for permitted client
    Invoice.findOne = (filter) => ({
      ...filter,
      clientId: allowedCrmId,
      status: 'unpaid',
      save: async () => {},
    });

    const patchResAdmin = await request(app)
      .patch(`/api/invoices/${new mongoose.Types.ObjectId()}/paid`)
      .set('x-role', 'ADMIN')
      .send({});
    assert.strictEqual(patchResAdmin.status, 200, 'ADMIN should be allowed to mark invoice paid');

    // 8. PATCH /api/invoices/:id/paid for restricted client -> 403
    Invoice.findOne = (filter) => ({
      ...filter,
      clientId: restrictedCrmId,
      status: 'unpaid',
      save: async () => {},
    });

    const patchResRestricted = await request(app)
      .patch(`/api/invoices/${new mongoose.Types.ObjectId()}/paid`)
      .set('x-role', 'ADMIN')
      .set('x-restricted', 'C_RESTRICTED')
      .send({});
    assert.strictEqual(patchResRestricted.status, 403, 'Marking paid for restricted client must return 403');

    console.log('✅ Task 2 (invoice routes RBAC & client deny-list) tests passed.');
  } finally {
    User.findOne = originalUserFindOne;
    Client.find = originalClientFind;
    Client.findOne = originalClientFindOne;
    CrmClient.find = originalCrmFind;
    CrmClient.findOne = originalCrmFindOne;
    Invoice.find = originalInvoiceFind;
    Invoice.findOne = originalInvoiceFindOne;
    Invoice.create = originalInvoiceCreate;
  }

  console.log('\n🎉 All Phase 1 RBAC Security Remediation tests passed successfully!');
})().catch((err) => {
  console.error('❌ Phase 1 test failure:', err);
  process.exit(1);
});
