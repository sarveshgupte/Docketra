#!/usr/bin/env node
const assert = require('assert');

const servicePath = require.resolve('../src/services/cmsIntake.service');
const leadModelPath = require.resolve('../src/models/Lead.model');
const firmModelPath = require.resolve('../src/models/Firm.model');
const clientServicePath = require.resolve('../src/services/client.service');
const routingServicePath = require.resolve('../src/services/routing.service');
const caseModelPath = require.resolve('../src/models/Case.model');
const docketAuditServicePath = require.resolve('../src/services/docketAudit.service');

function loadService({ leadMock, firmMock, clientMock, routingMock, caseMock, auditMock }) {
  delete require.cache[servicePath];
  require.cache[leadModelPath] = { exports: leadMock };
  require.cache[firmModelPath] = { exports: firmMock };
  require.cache[clientServicePath] = { exports: clientMock };
  require.cache[routingServicePath] = { exports: routingMock };
  require.cache[caseModelPath] = { exports: caseMock };
  require.cache[docketAuditServicePath] = { exports: auditMock };
  return require(servicePath);
}

async function testIdempotentReplayForPublicForm() {
  const calls = { leadCreate: 0, caseCreate: 0, clientCreate: 0 };
  const existingLead = {
    _id: 'lead-existing',
    source: 'form',
    metadata: {
      submissionMode: 'public_form',
      pageSlug: 'intake',
      formSlug: 'form-1',
      intakeOutcome: {
        createdClient: true,
        createdDocket: true,
        clientId: 'C100001',
        docketId: 'DCK-9001',
        warnings: [],
      },
    },
  };

  const cmsIntake = loadService({
    leadMock: {
      findOne: () => ({ sort: () => ({ lean: async () => existingLead }) }),
      create: async () => {
        calls.leadCreate += 1;
        return { _id: 'lead-new' };
      },
    },
    firmMock: { findById: () => ({ select: () => ({ lean: async () => ({ intakeConfig: { cms: {} } }) }) }) },
    clientMock: {
      findClientByEmailOrPhone: async () => null,
      createClient: async () => {
        calls.clientCreate += 1;
        return { clientId: 'C-NEW' };
      },
    },
    routingMock: {
      mapServiceToRouting: async () => ({ categoryId: 'cat', subcategoryId: 'sub', workbasketId: 'wb' }),
    },
    caseMock: {
      create: async () => {
        calls.caseCreate += 1;
        return { caseId: 'DCK-NEW' };
      },
    },
    auditMock: { logDocketEvent: async () => ({}) },
  });

  const result = await cmsIntake.processCmsSubmission({
    firmId: 'firm-1',
    payload: {
      name: 'Replay User',
      email: 'replay@example.com',
      idempotencyKey: 'idem-public-1',
    },
    submissionMode: 'public_form',
  });

  assert.strictEqual(result.lead._id, 'lead-existing');
  assert.strictEqual(result.metadata.idempotentReplay, true);
  assert.strictEqual(calls.leadCreate, 0);
  assert.strictEqual(calls.clientCreate, 0);
  assert.strictEqual(calls.caseCreate, 0);
}

async function run() {
  try {
    await testIdempotentReplayForPublicForm();
    console.log('CMS intake idempotency tests passed.');
  } catch (error) {
    console.error('CMS intake idempotency tests failed:', error);
    process.exit(1);
  } finally {
    delete require.cache[servicePath];
    delete require.cache[leadModelPath];
    delete require.cache[firmModelPath];
    delete require.cache[clientServicePath];
    delete require.cache[routingServicePath];
    delete require.cache[caseModelPath];
    delete require.cache[docketAuditServicePath];
  }
}

run();
