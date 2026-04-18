#!/usr/bin/env node
const assert = require('assert');

const cmsIntakeService = require('../src/services/cmsIntake.service');
const Lead = require('../src/models/Lead.model');
const Firm = require('../src/models/Firm.model');
const Case = require('../src/models/Case.model');
const clientService = require('../src/services/client.service');
const routingService = require('../src/services/routing.service');
const docketAuditService = require('../src/services/docketAudit.service');

async function testLeadOnlyFlow() {
  const originalLeadCreate = Lead.create;
  const originalFirmFindById = Firm.findById;

  Lead.create = async (payload) => ({ _id: 'lead-1', ...payload });
  Firm.findById = () => ({ select: () => ({ lean: async () => null }) });

  try {
    const result = await cmsIntakeService.processCmsSubmission({
      firmId: '507f1f77bcf86cd799439011',
      payload: { name: 'Alice', email: 'alice@example.com', phone: '999', source: 'form' },
      intakeConfig: { autoCreateClient: false, autoCreateDocket: false },
      submissionMode: 'public_form',
    });

    assert.strictEqual(result.lead._id, 'lead-1');
    assert.strictEqual(result.client, null);
    assert.strictEqual(result.docket, null);
    assert.strictEqual(result.submissionMode, 'public_form');
  } finally {
    Lead.create = originalLeadCreate;
    Firm.findById = originalFirmFindById;
  }
}

async function testLeadAndClientFlow() {
  const originalLeadCreate = Lead.create;
  const originalFirmFindById = Firm.findById;
  const originalFindClient = clientService.findClientByEmailOrPhone;
  const originalCreateClient = clientService.createClient;

  Lead.create = async (payload) => ({ _id: 'lead-2', ...payload });
  Firm.findById = () => ({ select: () => ({ lean: async () => null }) });
  clientService.findClientByEmailOrPhone = async () => null;
  clientService.createClient = async () => ({ _id: 'client-doc-1', clientId: 'C000123' });

  try {
    const result = await cmsIntakeService.processCmsSubmission({
      firmId: '507f1f77bcf86cd799439011',
      payload: { name: 'Bob', email: 'bob@example.com', phone: '123456', source: 'cms' },
      intakeConfig: { autoCreateClient: true, autoCreateDocket: false },
    });

    assert.strictEqual(result.lead._id, 'lead-2');
    assert.strictEqual(result.client.clientId, 'C000123');
    assert.strictEqual(result.docket, null);
  } finally {
    Lead.create = originalLeadCreate;
    Firm.findById = originalFirmFindById;
    clientService.findClientByEmailOrPhone = originalFindClient;
    clientService.createClient = originalCreateClient;
  }
}

async function testLeadClientAndDocketFlow() {
  const originalLeadCreate = Lead.create;
  const originalFirmFindById = Firm.findById;
  const originalFindClient = clientService.findClientByEmailOrPhone;
  const originalCreateClient = clientService.createClient;
  const originalMapRouting = routingService.mapServiceToRouting;
  const originalCaseCreate = Case.create;
  const originalLogDocketEvent = docketAuditService.logDocketEvent;

  Lead.create = async (payload) => ({ _id: 'lead-3', ...payload });
  Firm.findById = () => ({ select: () => ({ lean: async () => null }) });
  clientService.findClientByEmailOrPhone = async () => null;
  clientService.createClient = async () => ({ _id: 'client-doc-2', clientId: 'C000124' });
  routingService.mapServiceToRouting = async () => ({
    category: 'Tax',
    subcategory: 'GST Filing',
    categoryId: 'cat-1',
    subcategoryId: 'sub-1',
    workbasketId: 'wb-1',
  });
  Case.create = async (payload) => ({ _id: 'case-doc-1', caseId: 'CASE-20260418-00001', ...payload });
  docketAuditService.logDocketEvent = async () => ({ _id: 'audit-1' });

  try {
    const result = await cmsIntakeService.processCmsSubmission({
      firmId: '507f1f77bcf86cd799439011',
      payload: {
        name: 'Carol',
        email: 'carol@example.com',
        phone: '55555',
        service: 'GST Filing',
        source: 'cms_form',
      },
      intakeConfig: { autoCreateClient: true, autoCreateDocket: true },
    });

    assert.strictEqual(result.lead._id, 'lead-3');
    assert.strictEqual(result.client.clientId, 'C000124');
    assert.strictEqual(result.docket.caseId, 'CASE-20260418-00001');
  } finally {
    Lead.create = originalLeadCreate;
    Firm.findById = originalFirmFindById;
    clientService.findClientByEmailOrPhone = originalFindClient;
    clientService.createClient = originalCreateClient;
    routingService.mapServiceToRouting = originalMapRouting;
    Case.create = originalCaseCreate;
    docketAuditService.logDocketEvent = originalLogDocketEvent;
  }
}

async function testInvalidRoutingConfigGracefulFailure() {
  const originalLeadCreate = Lead.create;
  const originalFirmFindById = Firm.findById;
  const originalFindClient = clientService.findClientByEmailOrPhone;
  const originalCreateClient = clientService.createClient;

  Lead.create = async (payload) => ({ _id: 'lead-4', ...payload });
  Firm.findById = () => ({ select: () => ({ lean: async () => null }) });
  clientService.findClientByEmailOrPhone = async () => ({ _id: 'client-doc-3', clientId: 'C000125' });
  clientService.createClient = async () => {
    throw new Error('should not be called');
  };

  try {
    const result = await cmsIntakeService.processCmsSubmission({
      firmId: '507f1f77bcf86cd799439011',
      payload: { name: 'Dave', email: 'dave@example.com', phone: '8888', source: 'cms' },
      intakeConfig: { autoCreateClient: true, autoCreateDocket: true },
    });

    assert.strictEqual(result.lead._id, 'lead-4');
    assert.strictEqual(result.client.clientId, 'C000125');
    assert.strictEqual(result.docket, null);
    assert.ok(result.metadata.warnings.some((warning) => warning.includes('Docket routing is incomplete')));
  } finally {
    Lead.create = originalLeadCreate;
    Firm.findById = originalFirmFindById;
    clientService.findClientByEmailOrPhone = originalFindClient;
    clientService.createClient = originalCreateClient;
  }
}

async function testBackwardCompatibleHandleFormSubmission() {
  const originalLeadCreate = Lead.create;
  const originalFirmFindById = Firm.findById;
  const originalFindClient = clientService.findClientByEmailOrPhone;
  const originalCreateClient = clientService.createClient;

  Lead.create = async (payload) => ({ _id: 'lead-legacy', ...payload });
  Firm.findById = () => ({ select: () => ({ lean: async () => null }) });
  clientService.findClientByEmailOrPhone = async () => ({ _id: 'client-legacy', clientId: 'C009999' });
  clientService.createClient = async () => ({ _id: 'client-legacy', clientId: 'C009999' });
  try {
    const result = await cmsIntakeService.handleFormSubmission({
      firmId: '507f1f77bcf86cd799439011',
      formData: { name: 'Legacy', email: 'legacy@example.com', phone: '1' },
      source: 'CMS_FORM',
    });

    assert.strictEqual(result.lead._id, 'lead-legacy');
    assert.ok(Object.prototype.hasOwnProperty.call(result, 'client'));
    assert.ok(Object.prototype.hasOwnProperty.call(result, 'docket'));
  } finally {
    Lead.create = originalLeadCreate;
    Firm.findById = originalFirmFindById;
    clientService.findClientByEmailOrPhone = originalFindClient;
    clientService.createClient = originalCreateClient;
  }
}

async function run() {
  try {
    await testLeadOnlyFlow();
    await testLeadAndClientFlow();
    await testLeadClientAndDocketFlow();
    await testInvalidRoutingConfigGracefulFailure();
    await testBackwardCompatibleHandleFormSubmission();
    console.log('CMS intake service tests passed.');
  } catch (error) {
    console.error('CMS intake service tests failed:', error);
    process.exit(1);
  }
}

run();
