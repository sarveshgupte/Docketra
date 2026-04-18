#!/usr/bin/env node
const assert = require('assert');

const servicePath = require.resolve('../src/services/cmsIntake.service');
const clientServicePath = require.resolve('../src/services/client.service');
const routingServicePath = require.resolve('../src/services/routing.service');
const caseModelPath = require.resolve('../src/models/Case.model');
const docketAuditServicePath = require.resolve('../src/services/docketAudit.service');

function loadService({ clientMock, routingMock, caseMock, auditMock }) {
  delete require.cache[servicePath];
  require.cache[clientServicePath] = { exports: clientMock };
  require.cache[routingServicePath] = { exports: routingMock };
  require.cache[caseModelPath] = { exports: caseMock };
  require.cache[docketAuditServicePath] = { exports: auditMock };
  return require(servicePath);
}

async function testFormSubmissionCreatesClientDocketRoutesAndAudits() {
  const captured = {
    createClient: [],
    caseCreate: [],
    audit: [],
  };

  const caseMock = {
    create: async (payload) => {
      captured.caseCreate.push(payload);
      return { caseId: 'DCK-1001', ...payload };
    },
  };

  const clientMock = {
    findClientByEmailOrPhone: async () => null,
    createClient: async (payload) => {
      captured.createClient.push(payload);
      return {
        id: 'cl_1',
        clientId: 'C000101',
        ...payload,
      };
    },
  };

  const routingMock = {
    mapServiceToRouting: async () => ({
      category: 'Tax',
      subcategory: 'GST Filing',
      categoryId: 'cat_1',
      subcategoryId: 'sub_1',
      workbasketId: 'wb_1',
    }),
  };

  const auditMock = {
    logDocketEvent: async (entry) => {
      captured.audit.push(entry);
      return entry;
    },
  };

  const cmsIntake = loadService({ clientMock, routingMock, caseMock, auditMock });

  const result = await cmsIntake.handleFormSubmission({
    firmId: 'firm_1',
    formData: {
      name: 'Jane Doe',
      email: 'JANE@example.com',
      phone: '+15551234567',
      service: 'GST Filing',
      message: 'Need monthly filing support',
    },
  });

  assert.ok(result.client);
  assert.ok(result.docket);
  assert.strictEqual(captured.createClient.length, 1);
  assert.strictEqual(captured.caseCreate.length, 1);
  assert.strictEqual(captured.caseCreate[0].state, 'IN_WB');
  assert.strictEqual(captured.caseCreate[0].lifecycle, 'ACTIVE');
  assert.strictEqual(captured.audit.length, 2);
  assert.strictEqual(captured.audit[0].event, 'DOCKET_CREATED');
  assert.strictEqual(captured.audit[1].event, 'LEAD_CREATED');
}

async function testValidation() {
  const cmsIntake = loadService({
    clientMock: { findClientByEmailOrPhone: async () => null, createClient: async () => null },
    routingMock: { mapServiceToRouting: async () => null },
    caseMock: { create: async () => null },
    auditMock: { logDocketEvent: async () => null },
  });

  await assert.rejects(
    () => cmsIntake.handleFormSubmission({
      firmId: 'firm_1',
      formData: { name: '', email: '', phone: '', service: '' },
    }),
    /Invalid form submission/
  );
}

async function run() {
  try {
    await testFormSubmissionCreatesClientDocketRoutesAndAudits();
    await testValidation();
    console.log('CMS intake tests passed.');
  } catch (error) {
    console.error('CMS intake tests failed:', error);
    process.exit(1);
  } finally {
    delete require.cache[servicePath];
    delete require.cache[clientServicePath];
    delete require.cache[routingServicePath];
    delete require.cache[caseModelPath];
    delete require.cache[docketAuditServicePath];
  }
}

run();
