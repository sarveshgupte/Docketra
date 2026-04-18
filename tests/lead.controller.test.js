#!/usr/bin/env node
const assert = require('assert');
const mongoose = require('mongoose');

const mockLeadModel = {
  create: async (payload) => ({ toObject: () => ({ _id: 'lead-1', ...payload }) }),
  find: () => {
    const chain = {
      sort: () => chain,
      skip: () => chain,
      limit: () => chain,
      lean: async () => [],
    };
    return chain;
  },
  findOne: async () => null,
};

const mockCrmClientModel = {
  create: async () => ([{ _id: 'legacy-crm-1' }]),
  findOne: () => ({ session: async () => null }),
};

const mockCaseModel = { aggregate: async () => [] };
const mockUserModel = {
  findOne: () => ({ select: () => ({ lean: async () => ({ xid: 'DK-AAAA1', xID: 'X000010' }) }) }),
  find: () => ({ select: () => ({ lean: async () => [] }) }),
};

const mockCrmMappingService = {
  upsertCanonicalClientFromCrm: async () => ({ _id: 'canonical-1', clientId: 'C000123' }),
};

const inject = (target, exportsValue) => {
  const resolved = require.resolve(target);
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports: exportsValue,
  };
};

inject('../src/models/Lead.model', mockLeadModel);
inject('../src/models/CrmClient.model', mockCrmClientModel);
inject('../src/models/Case.model', mockCaseModel);
inject('../src/models/User.model', mockUserModel);
inject('../src/services/crmClientMapping.service', mockCrmMappingService);

const leadController = require('../src/controllers/lead.controller');

const createReqRes = ({ body = {}, params = {}, query = {} } = {}) => {
  const req = {
    body,
    params,
    query,
    user: { firmId: '507f1f77bcf86cd799439011', xid: 'DK-AB123' },
  };
  const res = {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.payload = data; return this; },
  };
  return { req, res };
};

async function testCreateLeadDefaults() {
  const { req, res } = createReqRes({ body: { name: 'Lead One', email: 'a@a.com' } });
  await leadController.createLead(req, res);
  assert.strictEqual(res.statusCode, 201);
  assert.strictEqual(res.payload.data.stage, 'new');
  assert.strictEqual(res.payload.data.status, 'new');
}

async function testStageTransitionAndFollowUpAndLost() {
  const saved = [];
  const leadDoc = {
    _id: 'lead-2',
    stage: 'new',
    status: 'new',
    ownerXid: null,
    notes: [],
    activitySummary: [],
    save: async () => { saved.push(true); },
    toObject: () => ({ _id: 'lead-2', stage: leadDoc.stage, status: leadDoc.status, ownerXid: leadDoc.ownerXid, nextFollowUpAt: leadDoc.nextFollowUpAt, lostReason: leadDoc.lostReason, notes: leadDoc.notes, activitySummary: leadDoc.activitySummary }),
  };
  mockLeadModel.findOne = async () => leadDoc;

  const { req, res } = createReqRes({ params: { id: '507f191e810c19729de860ea' }, body: { stage: 'lost', nextFollowUpAt: '2026-05-01T00:00:00.000Z', lostReason: 'Budget', note: 'No budget this quarter' } });
  await leadController.updateLeadStatus(req, res);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.payload.data.stage, 'lost');
  assert.strictEqual(res.payload.data.status, 'lost');
  assert.strictEqual(res.payload.data.lostReason, 'Budget');
  assert.strictEqual(res.payload.data.notes.length, 1);
  assert.ok(saved.length > 0);
}

async function testOwnerAssignmentValidation() {
  mockUserModel.findOne = () => ({ select: () => ({ lean: async () => null }) });
  const leadDoc = {
    _id: 'lead-3',
    stage: 'new',
    status: 'new',
    ownerXid: null,
    notes: [],
    activitySummary: [],
    save: async () => {},
    toObject: () => ({ _id: 'lead-3', stage: 'new', status: 'new' }),
  };
  mockLeadModel.findOne = async () => leadDoc;

  const { req, res } = createReqRes({ params: { id: '507f191e810c19729de860eb' }, body: { ownerXid: 'X000404' } });
  await leadController.updateLeadStatus(req, res);
  assert.strictEqual(res.statusCode, 400);
}

async function testConvertLeadUpdatesState() {
  mockUserModel.findOne = () => ({ select: () => ({ lean: async () => ({ xid: 'DK-AAAA1', xID: 'X000010' }) }) });
  const leadDoc = {
    _id: 'lead-4',
    name: 'Convert Me',
    email: 'convert@example.com',
    phone: '111',
    stage: 'qualified',
    status: 'qualified',
    linkedClientId: null,
    activitySummary: [],
    save: async () => {},
  };

  mockLeadModel.findOne = () => ({ session: async () => leadDoc });

  const originalStartSession = mongoose.startSession;
  mongoose.startSession = async () => ({
    withTransaction: async (cb) => cb(),
    endSession: async () => {},
  });

  const { req, res } = createReqRes({ params: { id: '507f191e810c19729de860ec' } });
  await leadController.convertLead(req, res);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.payload.data.lead.stage, 'converted');
  assert.strictEqual(res.payload.data.lead.status, 'converted');
  assert.ok(res.payload.data.conversion.convertedAt);
  assert.strictEqual(res.payload.data.conversion.convertedClientId, 'C000123');

  mongoose.startSession = originalStartSession;
}

async function run() {
  try {
    await testCreateLeadDefaults();
    await testStageTransitionAndFollowUpAndLost();
    await testOwnerAssignmentValidation();
    await testConvertLeadUpdatesState();
    console.log('Lead controller tests passed.');
  } catch (error) {
    console.error('Lead controller tests failed:', error);
    process.exit(1);
  }
}

run();
