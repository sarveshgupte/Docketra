#!/usr/bin/env node
'use strict';

const assert = require('assert');
const mongoose = require('mongoose');

const KnowledgeItem = require('../src/models/KnowledgeItem.model');
const Client = require('../src/models/Client.model');
const Case = require('../src/models/Case.model');
const ComplianceObligationTemplate = require('../src/models/ComplianceObligationTemplate.model');

const controllerPath = require.resolve('../src/controllers/knowledgeItem.controller');

function freshController() {
  delete require.cache[controllerPath];
  return require('../src/controllers/knowledgeItem.controller');
}

// 1. Verify Asset Linking & Types Creation
async function testCreateLinkedAssets() {
  const originalSave = KnowledgeItem.prototype.save;
  const originalCreate = KnowledgeItem.create;

  let savedData = null;
  KnowledgeItem.create = async function (payload) {
    savedData = new KnowledgeItem(payload);
    return savedData;
  };

  const clientMockId = new mongoose.Types.ObjectId();
  const templateMockId = new mongoose.Types.ObjectId();

  const req = {
    body: {
      title: 'GST GSTR-1 SOP V1',
      type: 'last_good_example',
      status: 'active',
      summary: 'Golden standard filing GSTR-1 example',
      linkedClientId: clientMockId.toString(),
      linkedObligationTemplateId: templateMockId.toString(),
      linkedDocketType: 'GST Filing Category',
      linkedServiceLine: 'GST',
      linkedStage: 'OPEN',
    },
    user: {
      firmId: new mongoose.Types.ObjectId(),
      email: 'admin@example.com',
      xID: 'X000001',
      role: 'ADMIN',
    },
  };

  let jsonResult;
  const res = {
    status: function (code) {
      this.statusCode = code;
      return this;
    },
    json: function (data) {
      jsonResult = data;
      return this;
    },
  };

  try {
    const controller = freshController();
    await controller.createKnowledgeItem(req, res);

    assert.strictEqual(res.statusCode, 201);
    assert.ok(savedData);
    assert.strictEqual(savedData.type, 'last_good_example');
    assert.strictEqual(savedData.linkedServiceLine, 'GST');
    assert.strictEqual(savedData.linkedStage, 'OPEN');
    assert.strictEqual(String(savedData.linkedClientId), clientMockId.toString());
    assert.strictEqual(String(savedData.linkedObligationTemplateId), templateMockId.toString());

    console.log('✓ Reusable Sop/good examples/review note asset linking and type creation verified');
  } finally {
    KnowledgeItem.prototype.save = originalSave;
    KnowledgeItem.create = originalCreate;
  }
}

// 2. Verify Docket Workspace Relevant Asset Retrieval
async function testWorkspaceAssetsRetrieval() {
  const originalFindCase = Case.findOne;
  const originalFindClient = Client.findOne;
  const originalFindTemplate = ComplianceObligationTemplate.findOne;
  const originalFindException = KnowledgeItem.find;

  const clientObjId = new mongoose.Types.ObjectId();
  const templateObjId = new mongoose.Types.ObjectId();
  const caseObjId = new mongoose.Types.ObjectId();

  Case.findOne = () => ({
    lean: async () => ({
      _id: caseObjId,
      caseId: 'DCK-00071',
      caseNumber: 'DCK-00071',
      clientId: 'C000101',
      obligation_type: 'GST',
      category: 'GST Category',
      subcategory: 'GSTR-1 subcategory',
      status: 'QC_PENDING',
      categoryId: new mongoose.Types.ObjectId(),
    })
  });

  Client.findOne = () => ({
    lean: async () => ({ _id: clientObjId, clientId: 'C000101' }),
  });

  ComplianceObligationTemplate.findOne = () => ({
    lean: async () => ({ _id: templateObjId, obligationType: 'GST' }),
  });

  const mockActiveAssets = [
    {
      title: 'GSTR-1 Golden Example',
      type: 'last_good_example',
      linkedServiceLine: 'GST',
    },
    {
      title: 'Filing SOP V3',
      type: 'sop',
      linkedObligationTemplateId: templateObjId,
    },
  ];

  let capturedQuery = null;
  KnowledgeItem.find = (query) => {
    capturedQuery = query;
    return {
      sort: () => ({
        lean: async () => mockActiveAssets,
      }),
    };
  };

  const req = {
    params: { caseId: 'DCK-00071' },
    user: {
      firmId: new mongoose.Types.ObjectId(),
    },
  };

  let jsonResult;
  const res = {
    status: function (code) {
      this.statusCode = code;
      return this;
    },
    json: function (data) {
      jsonResult = data;
      return this;
    },
  };

  try {
    const controller = freshController();
    await controller.getWorkspaceAssets(req, res);

    assert.strictEqual(jsonResult.success, true);
    assert.strictEqual(jsonResult.data.length, 2);

    // Verify query structure - matches client, service line, docket type, stage
    assert.ok(capturedQuery);
    assert.strictEqual(capturedQuery.status, 'active');
    assert.ok(capturedQuery.$or);

    // Check GSTR-1 Golden Example
    const goodEx = jsonResult.data.find(a => a.type === 'last_good_example');
    assert.strictEqual(goodEx.linkedServiceLine, 'GST');

    console.log('✓ Docket workspace relevant operational asset retrieval verified');
  } finally {
    Case.findOne = originalFindCase;
    Client.findOne = originalFindClient;
    ComplianceObligationTemplate.findOne = originalFindTemplate;
    KnowledgeItem.find = originalFindException;
  }
}

// 3. Verify Repeated Review Comments & Missing SOPs reporting
async function testReportingOperationalAnalytics() {
  const originalFindCase = Case.find;
  const originalFindAssets = KnowledgeItem.find;

  const casesMock = [
    {
      category: 'GST Filings',
      subcategory: 'GSTR-1 Filing',
      checklist: [
        { reviewerNotes: 'Calculation error on ITC' },
        { reviewerNotes: 'Calculation error on ITC' },
      ],
    },
    {
      category: 'TDS Filings',
      subcategory: 'TDS-26Q Filing',
      checklist: [
        { reviewerNotes: 'PAN card missing' },
      ],
    },
  ];

  Case.find = () => ({
    select: () => ({
      lean: async () => casesMock,
    }),
  });

  const mockActiveSops = [
    { type: 'sop', linkedServiceLine: 'GST' },
    { type: 'template', linkedServiceLine: 'GST' },
    { type: 'sop', linkedServiceLine: 'TDS' },
    // ROC is missing both sop and template
    // ANNUAL_FILING is missing template
  ];

  KnowledgeItem.find = () => ({
    lean: async () => mockActiveSops,
  });

  const req = {
    user: {
      firmId: new mongoose.Types.ObjectId(),
    },
  };

  let jsonResult;
  const res = {
    status: function (code) {
      this.statusCode = code;
      return this;
    },
    json: function (data) {
      jsonResult = data;
      return this;
    },
  };

  try {
    const controller = freshController();
    await controller.getFirmMemoryReports(req, res);

    assert.strictEqual(jsonResult.success, true);
    const reports = jsonResult.data;

    // Assert repeated review comments counts
    const repeated = reports.repeatedReviewComments;
    assert.strictEqual(repeated.length, 2);
    assert.strictEqual(repeated[0].comment, 'Calculation error on ITC');
    assert.strictEqual(repeated[0].count, 2);

    // Assert missing service line SOPs / templates
    const missing = reports.missingSopsAndTemplates;
    const rocMissing = missing.find(m => m.serviceLine === 'ROC');
    assert.strictEqual(rocMissing.missingSop, true);
    assert.strictEqual(rocMissing.missingTemplate, true);

    const tdsMissing = missing.find(m => m.serviceLine === 'TDS');
    assert.strictEqual(tdsMissing.missingTemplate, true);
    assert.strictEqual(tdsMissing.missingSop, false);

    console.log('✓ Repeated review comments and missing service line SOPs reports verified');
  } finally {
    Case.find = originalFindCase;
    KnowledgeItem.find = originalFindAssets;
  }
}

async function run() {
  console.log('Running Docketra Firm Memory V1 integration tests...');
  try {
    await testCreateLinkedAssets();
    await testWorkspaceAssetsRetrieval();
    await testReportingOperationalAnalytics();
    console.log('All Docketra Firm Memory V1 integration tests passed successfully!');
  } catch (error) {
    console.error('Docketra Firm Memory V1 tests failed:', error);
    process.exit(1);
  }
}

run();
