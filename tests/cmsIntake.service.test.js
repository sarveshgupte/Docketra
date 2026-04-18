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
      payload: {
        name: 'Alice',
        email: 'alice@example.com',
        phone: '999',
        source: 'website_embed',
        pageUrl: 'https://firm.com/intake',
        formId: '507f1f77bcf86cd799439099',
        formSlug: 'tax-intake',
      },
      requestMeta: {
        headers: { referer: 'https://firm.com/intake', 'user-agent': 'Mozilla/5.0 test' },
        query: { utm_source: 'google', utm_campaign: 'spring', utm_medium: 'cpc' },
      },
      intakeConfig: { autoCreateClient: false, autoCreateDocket: false },
      submissionMode: 'embedded_form',
    });

    assert.strictEqual(result.lead._id, 'lead-1');
    assert.strictEqual(result.client, null);
    assert.strictEqual(result.docket, null);
    assert.strictEqual(result.submissionMode, 'embedded_form');
    assert.strictEqual(result.lead.source, 'website_embed');
    assert.strictEqual(result.lead.metadata.pageUrl, 'https://firm.com/intake');
    assert.strictEqual(result.lead.metadata.utm_source, 'google');
    assert.strictEqual(result.lead.metadata.utm_campaign, 'spring');
    assert.strictEqual(result.lead.metadata.utm_medium, 'cpc');
    assert.strictEqual(result.lead.metadata.formId, '507f1f77bcf86cd799439099');
    assert.strictEqual(result.lead.metadata.formSlug, 'tax-intake');
    assert.strictEqual(result.lead.metadata.submissionMode, 'embedded_form');
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

async function testApiIntakeIdempotencyAndMetadata() {
  const originalLeadCreate = Lead.create;
  const originalLeadFindOne = Lead.findOne;
  const originalFirmFindById = Firm.findById;

  Lead.create = async (payload) => ({ _id: 'lead-api-1', ...payload });
  Lead.findOne = () => ({ sort: () => ({ lean: async () => null }) });
  Firm.findById = () => ({ select: () => ({ lean: async () => null }) });

  try {
    const created = await cmsIntakeService.processCmsSubmission({
      firmId: '507f1f77bcf86cd799439011',
      payload: {
        name: 'API User',
        email: 'api@example.com',
        idempotencyKey: 'idem-123',
        customStatus: 'urgent',
      },
      intakeConfig: { autoCreateClient: false, autoCreateDocket: false },
      submissionMode: 'api_intake',
    });

    assert.strictEqual(created.lead.source, 'api_integration');
    assert.strictEqual(created.lead.metadata.submissionMode, 'api_intake');
    assert.strictEqual(created.lead.metadata.idempotencyKey, 'idem-123');
    assert.strictEqual(created.lead.metadata.extraFields.customStatus, 'urgent');

    Lead.findOne = () => ({ sort: () => ({ lean: async () => ({ _id: 'lead-existing', source: 'api_integration', metadata: { pageSlug: null, formSlug: null } }) }) });
    const replay = await cmsIntakeService.processCmsSubmission({
      firmId: '507f1f77bcf86cd799439011',
      payload: { name: 'API User', idempotencyKey: 'idem-123' },
      intakeConfig: { autoCreateClient: false, autoCreateDocket: false },
      submissionMode: 'api_intake',
    });
    assert.strictEqual(replay.lead._id, 'lead-existing');
    assert.strictEqual(replay.metadata.idempotentReplay, true);
  } finally {
    Lead.create = originalLeadCreate;
    Lead.findOne = originalLeadFindOne;
    Firm.findById = originalFirmFindById;
  }
}

async function run() {
  try {
    await testLeadOnlyFlow();
    await testLeadAndClientFlow();
    await testLeadClientAndDocketFlow();
    await testInvalidRoutingConfigGracefulFailure();
    await testBackwardCompatibleHandleFormSubmission();
    await testApiIntakeIdempotencyAndMetadata();
    console.log('CMS intake service tests passed.');
  } catch (error) {
    console.error('CMS intake service tests failed:', error);
    process.exit(1);
  }
}

run();
