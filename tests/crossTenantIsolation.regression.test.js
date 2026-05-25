#!/usr/bin/env node
const assert = require('assert');
const Module = require('module');

const originalLoad = Module._load;

let attachmentFindOneQuery = null;
let userFindOneQuery = null;

Module._load = function(request, parent, isMain) {
  if (request === '../models/Attachment.model') {
    return {
      findOne(query) {
        attachmentFindOneQuery = query;
        return { lean: async () => null };
      },
    };
  }
  if (request === '../models/User.model') {
    return {
      findOne(query) {
        userFindOneQuery = query;
        return Promise.resolve(null);
      },
    };
  }
  if (request === '../models/Team.model') {
    return { findOne: async () => ({ _id: 'team1', firmId: 'firmA' }) };
  }
  if (request === '../utils/hierarchy.utils') return { assertPrimaryAdmin: () => {} };
  if (request === '../services/workbasketGuardrails.service') {
    return { createPrimaryWithQc: async () => ({}), isValidObjectId: () => true };
  }
  if (request.includes('adminActionAudit.service')) return { logAuditEvent: async () => {} };
  if (request.includes('ai.service')) return {};
  if (request.includes('../models/Client.model') || request.includes('../models/Category.model') || request.includes('../models/Case.model')) return {};
  if (request.includes('../utils/') || request.includes('../services/')) return new Proxy({}, { get: () => () => null });
  return originalLoad.apply(this, arguments);
};

const docketAiController = require('../src/controllers/docketAi.controller');
const teamController = require('../src/controllers/team.controller');

function mockRes() {
  return {
    statusCode: 200,
    payload: null,
    status(c) { this.statusCode = c; return this; },
    json(p) { this.payload = p; return this; },
  };
}

(async () => {
  const res1 = mockRes();
  await docketAiController.getAttachmentAiInsights({ params: { attachmentId: 'abc' }, firmId: 'firmA' }, res1);
  assert.strictEqual(attachmentFindOneQuery.firmId, 'firmA');
  assert.strictEqual(String(attachmentFindOneQuery._id), 'abc');

  const res2 = mockRes();
  await teamController.assignUserToTeam({ params: { id: 'team1' }, body: { userId: 'userB' }, user: { firmId: 'firmA', _id: 'admin1' } }, res2);
  assert.strictEqual(userFindOneQuery.firmId, 'firmA');
  assert.strictEqual(String(userFindOneQuery._id), 'userB');

  Module._load = originalLoad;
  console.log('✅ crossTenantIsolation.regression.test passed');
})().catch((err) => {
  Module._load = originalLoad;
  console.error('❌ crossTenantIsolation.regression.test failed', err);
  process.exit(1);
});
