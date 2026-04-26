#!/usr/bin/env node
const assert = require('assert');

const cmsIntakeService = require('../src/services/cmsIntake.service');
const Lead = require('../src/models/Lead.model');
const Client = require('../src/models/Client.model');
const Firm = require('../src/models/Firm.model');
const Case = require('../src/models/Case.model');
const clientService = require('../src/services/client.service');
const routingService = require('../src/services/routing.service');
const docketAuditService = require('../src/services/docketAudit.service');
const Team = require('../src/models/Team.model');

async function testLeadOnlyFlow() {
  const originalLeadCreate = Lead.create;
  const originalLeadFindByIdAndUpdate = Lead.findByIdAndUpdate;
  const originalLeadFind = Lead.find;
  const originalClientFind = Client.find;
  const originalFirmFindById = Firm.findById;

  Lead.create = async (payload) => ({ _id: '507f1f77bcf86cd799439101', ...payload });
  Lead.findByIdAndUpdate = async () => ({ _id: '507f1f77bcf86cd799439101' });
  Lead.find = () => ({ select: () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) }) });
  Client.find = () => ({ select: () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) }) });
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

    assert.strictEqual(result.lead._id, '507f1f77bcf86cd799439101');
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
    assert.strictEqual(result.metadata.warningDetails.some((warning) => warning.code === 'duplicate_match'), false);
  } finally {
    Lead.create = originalLeadCreate;
    Lead.findByIdAndUpdate = originalLeadFindByIdAndUpdate;
    Lead.find = originalLeadFind;
    Client.find = originalClientFind;
    Firm.findById = originalFirmFindById;
  }
}

async function testLeadAndClientFlow() {
  const originalLeadCreate = Lead.create;
  const originalLeadFindByIdAndUpdate = Lead.findByIdAndUpdate;
  const originalLeadFind = Lead.find;
  const originalClientFind = Client.find;
  const originalFirmFindById = Firm.findById;
  const originalFindClient = clientService.findClientByEmailOrPhone;
  const originalCreateClient = clientService.createClient;

  Lead.create = async (payload) => ({ _id: '507f1f77bcf86cd799439102', ...payload });
  Lead.findByIdAndUpdate = async () => ({ _id: '507f1f77bcf86cd799439102' });
  Lead.find = () => ({ select: () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) }) });
  Client.find = () => ({ select: () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) }) });
  Firm.findById = () => ({ select: () => ({ lean: async () => null }) });
  clientService.findClientByEmailOrPhone = async () => null;
  clientService.createClient = async () => ({ _id: 'client-doc-1', clientId: 'C000123' });

  try {
    const result = await cmsIntakeService.processCmsSubmission({
      firmId: '507f1f77bcf86cd799439011',
      payload: { name: 'Bob', email: 'bob@example.com', phone: '123456', source: 'cms' },
      intakeConfig: { autoCreateClient: true, autoCreateDocket: false },
    });

    assert.strictEqual(result.lead._id, '507f1f77bcf86cd799439102');
    assert.strictEqual(result.client.clientId, 'C000123');
    assert.strictEqual(result.docket, null);
  } finally {
    Lead.create = originalLeadCreate;
    Lead.findByIdAndUpdate = originalLeadFindByIdAndUpdate;
    Lead.find = originalLeadFind;
    Client.find = originalClientFind;
    Firm.findById = originalFirmFindById;
    clientService.findClientByEmailOrPhone = originalFindClient;
    clientService.createClient = originalCreateClient;
  }
}

async function testLeadClientAndDocketFlow() {
  const originalLeadCreate = Lead.create;
  const originalLeadFindByIdAndUpdate = Lead.findByIdAndUpdate;
  const originalLeadFind = Lead.find;
  const originalClientFind = Client.find;
  const originalFirmFindById = Firm.findById;
  const originalFindClient = clientService.findClientByEmailOrPhone;
  const originalCreateClient = clientService.createClient;
  const originalMapRouting = routingService.mapServiceToRouting;
  const originalCaseCreate = Case.create;
  const originalLogDocketEvent = docketAuditService.logDocketEvent;
  const originalTeamFindOne = Team.findOne;
  const updateCalls = [];

  Lead.create = async (payload) => ({ _id: '507f1f77bcf86cd799439103', ...payload });
  Lead.findByIdAndUpdate = async (id, update) => {
    updateCalls.push({ id, update });
    return { _id: id };
  };
  Lead.find = () => ({ select: () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) }) });
  Client.find = () => ({ select: () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) }) });
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
  Team.findOne = () => ({ select: () => ({ lean: async () => ({ _id: 'wb-1' }) }) });

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

    assert.strictEqual(result.lead._id, '507f1f77bcf86cd799439103');
    assert.strictEqual(result.client.clientId, 'C000124');
    assert.strictEqual(result.docket.caseId, 'CASE-20260418-00001');
    assert.strictEqual(result.metadata.intakeOutcome.createdClient, true);
    assert.strictEqual(result.metadata.intakeOutcome.createdDocket, true);
    assert.strictEqual(result.metadata.intakeOutcome.clientId, 'C000124');
    assert.strictEqual(result.metadata.intakeOutcome.docketId, 'CASE-20260418-00001');
    assert.ok(Array.isArray(result.metadata.conversionTrail));
    assert.ok(result.metadata.conversionTrail.some((entry) => entry.target === 'client' && entry.status === 'created_new'));
    assert.ok(result.metadata.conversionTrail.some((entry) => entry.target === 'docket' && entry.status === 'succeeded'));
    assert.ok(updateCalls.length > 0);
  } finally {
    Lead.create = originalLeadCreate;
    Lead.findByIdAndUpdate = originalLeadFindByIdAndUpdate;
    Lead.find = originalLeadFind;
    Client.find = originalClientFind;
    Firm.findById = originalFirmFindById;
    clientService.findClientByEmailOrPhone = originalFindClient;
    clientService.createClient = originalCreateClient;
    routingService.mapServiceToRouting = originalMapRouting;
    Case.create = originalCaseCreate;
    docketAuditService.logDocketEvent = originalLogDocketEvent;
    Team.findOne = originalTeamFindOne;
  }
}

async function testInvalidRoutingConfigGracefulFailure() {
  const originalLeadCreate = Lead.create;
  const originalLeadFindByIdAndUpdate = Lead.findByIdAndUpdate;
  const originalLeadFind = Lead.find;
  const originalClientFind = Client.find;
  const originalFirmFindById = Firm.findById;
  const originalFindClient = clientService.findClientByEmailOrPhone;
  const originalCreateClient = clientService.createClient;

  const updateCalls = [];
  Lead.create = async (payload) => ({ _id: '507f1f77bcf86cd799439104', ...payload });
  Lead.findByIdAndUpdate = async (id, update) => {
    updateCalls.push({ id, update });
    return { _id: id };
  };
  Lead.find = () => ({ select: () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) }) });
  Client.find = () => ({ select: () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) }) });
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

    assert.strictEqual(result.lead._id, '507f1f77bcf86cd799439104');
    assert.strictEqual(result.client.clientId, 'C000125');
    assert.strictEqual(result.docket, null);
    assert.ok(result.metadata.warnings.some((warning) => warning.includes('Docket routing is incomplete')));
    assert.strictEqual(result.metadata.warningDetails[0].code, 'missing_routing');
    assert.strictEqual(result.metadata.intakeOutcome.createdClient, true);
    assert.strictEqual(result.metadata.intakeOutcome.createdDocket, false);
    assert.ok(result.metadata.intakeOutcome.warnings.length > 0);
    assert.strictEqual(result.metadata.intakeOutcome.warningDetails[0].code, 'missing_routing');
    assert.ok(updateCalls.length > 0);
  } finally {
    Lead.create = originalLeadCreate;
    Lead.findByIdAndUpdate = originalLeadFindByIdAndUpdate;
    Lead.find = originalLeadFind;
    Client.find = originalClientFind;
    Firm.findById = originalFirmFindById;
    clientService.findClientByEmailOrPhone = originalFindClient;
    clientService.createClient = originalCreateClient;
  }
}

async function testBackwardCompatibleHandleFormSubmission() {
  const originalLeadCreate = Lead.create;
  const originalLeadFindByIdAndUpdate = Lead.findByIdAndUpdate;
  const originalLeadFind = Lead.find;
  const originalClientFind = Client.find;
  const originalFirmFindById = Firm.findById;
  const originalFindClient = clientService.findClientByEmailOrPhone;
  const originalCreateClient = clientService.createClient;

  Lead.create = async (payload) => ({ _id: '507f1f77bcf86cd799439105', ...payload });
  Lead.findByIdAndUpdate = async () => ({ _id: '507f1f77bcf86cd799439105' });
  Lead.find = () => ({ select: () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) }) });
  Client.find = () => ({ select: () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) }) });
  Firm.findById = () => ({ select: () => ({ lean: async () => null }) });
  clientService.findClientByEmailOrPhone = async () => ({ _id: 'client-legacy', clientId: 'C009999' });
  clientService.createClient = async () => ({ _id: 'client-legacy', clientId: 'C009999' });
  try {
    const result = await cmsIntakeService.handleFormSubmission({
      firmId: '507f1f77bcf86cd799439011',
      formData: { name: 'Legacy', email: 'legacy@example.com', phone: '1' },
      source: 'CMS_FORM',
    });

    assert.strictEqual(result.lead._id, '507f1f77bcf86cd799439105');
    assert.ok(Object.prototype.hasOwnProperty.call(result, 'client'));
    assert.ok(Object.prototype.hasOwnProperty.call(result, 'docket'));
  } finally {
    Lead.create = originalLeadCreate;
    Lead.findByIdAndUpdate = originalLeadFindByIdAndUpdate;
    Lead.find = originalLeadFind;
    Client.find = originalClientFind;
    Firm.findById = originalFirmFindById;
    clientService.findClientByEmailOrPhone = originalFindClient;
    clientService.createClient = originalCreateClient;
  }
}

async function testApiIntakeIdempotencyAndMetadata() {
  const originalLeadCreate = Lead.create;
  const originalLeadFindByIdAndUpdate = Lead.findByIdAndUpdate;
  const originalLeadFindOne = Lead.findOne;
  const originalLeadFind = Lead.find;
  const originalClientFind = Client.find;
  const originalFirmFindById = Firm.findById;

  Lead.create = async (payload) => ({ _id: '507f1f77bcf86cd799439106', ...payload });
  Lead.findByIdAndUpdate = async () => ({ _id: '507f1f77bcf86cd799439106' });
  Lead.findOne = () => ({ sort: () => ({ lean: async () => null }) });
  Lead.find = () => ({ select: () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) }) });
  Client.find = () => ({ select: () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) }) });
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

    Lead.findOne = () => ({ sort: () => ({ lean: async () => ({ _id: '507f1f77bcf86cd799439107', source: 'api_integration', metadata: { pageSlug: null, formSlug: null } }) }) });
    const replay = await cmsIntakeService.processCmsSubmission({
      firmId: '507f1f77bcf86cd799439011',
      payload: { name: 'API User', idempotencyKey: 'idem-123' },
      intakeConfig: { autoCreateClient: false, autoCreateDocket: false },
      submissionMode: 'api_intake',
    });
    assert.strictEqual(replay.lead._id, '507f1f77bcf86cd799439107');
    assert.strictEqual(replay.metadata.idempotentReplay, true);
    assert.strictEqual(replay.metadata.warningDetails[0].code, 'idempotent_replay');
  } finally {
    Lead.create = originalLeadCreate;
    Lead.findByIdAndUpdate = originalLeadFindByIdAndUpdate;
    Lead.findOne = originalLeadFindOne;
    Lead.find = originalLeadFind;
    Client.find = originalClientFind;
    Firm.findById = originalFirmFindById;
  }
}

async function testDuplicateWarningFromIntakeIdentifiers() {
  const originalLeadCreate = Lead.create;
  const originalLeadFindByIdAndUpdate = Lead.findByIdAndUpdate;
  const originalLeadFind = Lead.find;
  const originalClientFind = Client.find;
  const originalFirmFindById = Firm.findById;

  Lead.create = async (payload) => ({ _id: '507f1f77bcf86cd799439108', ...payload });
  Lead.findByIdAndUpdate = async () => ({ _id: '507f1f77bcf86cd799439108' });
  Lead.find = () => ({
    select: () => ({
      sort: () => ({
        limit: () => ({
          lean: async () => ([{ _id: 'lead-existing-1', name: 'Existing Lead', email: 'dup@example.com', source: 'website_embed', createdAt: new Date().toISOString(), metadata: {} }]),
        }),
      }),
    }),
  });
  Client.find = () => ({
    select: () => ({
      sort: () => ({
        limit: () => ({
          lean: async () => ([{ clientId: 'C000900', businessName: 'Existing Client', businessEmail: 'dup@example.com' }]),
        }),
      }),
    }),
  });
  Firm.findById = () => ({ select: () => ({ lean: async () => null }) });

  try {
    const result = await cmsIntakeService.processCmsSubmission({
      firmId: '507f1f77bcf86cd799439011',
      payload: {
        name: 'Duplicate Signal',
        email: 'dup@example.com',
        pan: 'ABCDE1234F',
      },
      intakeConfig: { autoCreateClient: false, autoCreateDocket: false },
      submissionMode: 'public_form',
    });
    assert.strictEqual(result.metadata.warningDetails[0].code, 'duplicate_match');
    assert.ok(result.metadata.warningDetails[0].recovery.includes('Review existing lead/client records'));
    assert.ok(result.metadata.warningDetails[0].context.matches.leads.length > 0);
    assert.ok(result.metadata.warningDetails[0].context.matches.clients.length > 0);
  } finally {
    Lead.create = originalLeadCreate;
    Lead.findByIdAndUpdate = originalLeadFindByIdAndUpdate;
    Lead.find = originalLeadFind;
    Client.find = originalClientFind;
    Firm.findById = originalFirmFindById;
  }
}

async function testDuplicateWarningFromOlderLeadOnly() {
  const originalLeadCreate = Lead.create;
  const originalLeadFindByIdAndUpdate = Lead.findByIdAndUpdate;
  const originalLeadFind = Lead.find;
  const originalClientFind = Client.find;
  const originalFirmFindById = Firm.findById;

  Lead.create = async (payload) => ({ _id: '507f1f77bcf86cd799439109', ...payload });
  Lead.findByIdAndUpdate = async () => ({ _id: '507f1f77bcf86cd799439109' });
  Lead.find = (query) => ({
    select: () => ({
      sort: () => ({
        limit: () => ({
          lean: async () => {
            assert.ok(query._id && query._id.$ne, 'duplicate check should exclude current lead _id');
            return [{ _id: '507f1f77bcf86cd799439010', name: 'Old Lead', email: 'same@example.com', source: 'cms', metadata: {} }];
          },
        }),
      }),
    }),
  });
  Client.find = () => ({ select: () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) }) });
  Firm.findById = () => ({ select: () => ({ lean: async () => null }) });

  try {
    const result = await cmsIntakeService.processCmsSubmission({
      firmId: '507f1f77bcf86cd799439011',
      payload: {
        name: 'Lead Match',
        email: 'same@example.com',
      },
      intakeConfig: { autoCreateClient: false, autoCreateDocket: false },
      submissionMode: 'public_form',
    });
    const duplicateWarning = result.metadata.warningDetails.find((warning) => warning.code === 'duplicate_match');
    assert.ok(duplicateWarning, 'expected duplicate warning when matching older lead');
    assert.strictEqual(result.client, null, 'duplicate warning should remain non-blocking');
    assert.strictEqual(result.docket, null, 'duplicate warning should remain non-blocking');
  } finally {
    Lead.create = originalLeadCreate;
    Lead.findByIdAndUpdate = originalLeadFindByIdAndUpdate;
    Lead.find = originalLeadFind;
    Client.find = originalClientFind;
    Firm.findById = originalFirmFindById;
  }
}

async function testDuplicateWarningFromExistingClientOnly() {
  const originalLeadCreate = Lead.create;
  const originalLeadFindByIdAndUpdate = Lead.findByIdAndUpdate;
  const originalLeadFind = Lead.find;
  const originalClientFind = Client.find;
  const originalFirmFindById = Firm.findById;

  Lead.create = async (payload) => ({ _id: '507f1f77bcf86cd799439110', ...payload });
  Lead.findByIdAndUpdate = async () => ({ _id: '507f1f77bcf86cd799439110' });
  Lead.find = () => ({ select: () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) }) });
  Client.find = () => ({
    select: () => ({
      sort: () => ({
        limit: () => ({
          lean: async () => ([{ clientId: 'C123999', businessName: 'Client Match', businessEmail: 'clientmatch@example.com' }]),
        }),
      }),
    }),
  });
  Firm.findById = () => ({ select: () => ({ lean: async () => null }) });

  try {
    const result = await cmsIntakeService.processCmsSubmission({
      firmId: '507f1f77bcf86cd799439011',
      payload: {
        name: 'Client Match Lead',
        email: 'clientmatch@example.com',
      },
      intakeConfig: { autoCreateClient: false, autoCreateDocket: false },
      submissionMode: 'public_form',
    });
    const duplicateWarning = result.metadata.warningDetails.find((warning) => warning.code === 'duplicate_match');
    assert.ok(duplicateWarning, 'expected duplicate warning when matching existing client');
    assert.ok(result.metadata.intakeOutcome, 'duplicate warning should not block intake outcome');
  } finally {
    Lead.create = originalLeadCreate;
    Lead.findByIdAndUpdate = originalLeadFindByIdAndUpdate;
    Lead.find = originalLeadFind;
    Client.find = originalClientFind;
    Firm.findById = originalFirmFindById;
  }
}

async function testCurrentLeadExcludedFromDuplicateMatching() {
  const originalLeadCreate = Lead.create;
  const originalLeadFindByIdAndUpdate = Lead.findByIdAndUpdate;
  const originalLeadFind = Lead.find;
  const originalClientFind = Client.find;
  const originalFirmFindById = Firm.findById;
  const currentLeadId = '507f1f77bcf86cd799439111';

  Lead.create = async (payload) => ({ _id: currentLeadId, ...payload });
  Lead.findByIdAndUpdate = async () => ({ _id: currentLeadId });
  Lead.find = (query) => ({
    select: () => ({
      sort: () => ({
        limit: () => ({
          lean: async () => {
            assert.strictEqual(String(query?._id?.$ne || ''), currentLeadId, 'lead duplicate query must exclude current lead id');
            return [];
          },
        }),
      }),
    }),
  });
  Client.find = () => ({ select: () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) }) });
  Firm.findById = () => ({ select: () => ({ lean: async () => null }) });

  try {
    const result = await cmsIntakeService.processCmsSubmission({
      firmId: '507f1f77bcf86cd799439011',
      payload: {
        name: 'Self Lead',
        email: 'self@example.com',
      },
      intakeConfig: { autoCreateClient: false, autoCreateDocket: false },
      submissionMode: 'public_form',
    });
    assert.strictEqual(
      result.metadata.warningDetails.some((warning) => warning.code === 'duplicate_match'),
      false,
      'self-match should not generate duplicate warning'
    );
    assert.strictEqual(
      result.metadata.intakeDiagnostics?.warningDetails?.some((warning) => warning.code === 'duplicate_match') || false,
      false,
      'intake diagnostics should include duplicate warning only for genuine previous matches'
    );
  } finally {
    Lead.create = originalLeadCreate;
    Lead.findByIdAndUpdate = originalLeadFindByIdAndUpdate;
    Lead.find = originalLeadFind;
    Client.find = originalClientFind;
    Firm.findById = originalFirmFindById;
  }
}

async function testDuplicateLookupCanonicalizesExtraFieldKeys() {
  const originalLeadCreate = Lead.create;
  const originalLeadFindByIdAndUpdate = Lead.findByIdAndUpdate;
  const originalLeadFind = Lead.find;
  const originalClientFind = Client.find;
  const originalFirmFindById = Firm.findById;

  Lead.create = async (payload) => ({ _id: '507f1f77bcf86cd799439112', ...payload });
  Lead.findByIdAndUpdate = async () => ({ _id: '507f1f77bcf86cd799439112' });
  Lead.find = (query) => ({
    select: () => ({
      sort: () => ({
        limit: () => ({
          lean: async () => {
            const duplicatePanQuery = Array.isArray(query.$or)
              ? query.$or.find((condition) => condition['metadata.extraFields.pan'])
              : null;
            assert.ok(duplicatePanQuery, 'duplicate query should include canonicalized pan key');
            assert.strictEqual(duplicatePanQuery['metadata.extraFields.pan'], 'ABCDE1234F');
            return [];
          },
        }),
      }),
    }),
  });
  Client.find = () => ({ select: () => ({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) }) });
  Firm.findById = () => ({ select: () => ({ lean: async () => null }) });

  try {
    await cmsIntakeService.processCmsSubmission({
      firmId: '507f1f77bcf86cd799439011',
      payload: {
        name: 'Canonical Key',
        email: 'canonical@example.com',
        PAN: 'abcde1234f',
      },
      intakeConfig: { autoCreateClient: false, autoCreateDocket: false },
      submissionMode: 'public_form',
    });
  } finally {
    Lead.create = originalLeadCreate;
    Lead.findByIdAndUpdate = originalLeadFindByIdAndUpdate;
    Lead.find = originalLeadFind;
    Client.find = originalClientFind;
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
    await testDuplicateWarningFromIntakeIdentifiers();
    await testDuplicateWarningFromOlderLeadOnly();
    await testDuplicateWarningFromExistingClientOnly();
    await testCurrentLeadExcludedFromDuplicateMatching();
    await testDuplicateLookupCanonicalizesExtraFieldKeys();
    console.log('CMS intake service tests passed.');
  } catch (error) {
    console.error('CMS intake service tests failed:', error);
    process.exit(1);
  }
}

run();
