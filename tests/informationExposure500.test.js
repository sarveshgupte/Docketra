#!/usr/bin/env node
'use strict';

const assert = require('assert');
const mongoose = require('mongoose');

const log = require('../src/utils/log');

const capacityController = require('../src/controllers/capacity.controller');
const documentItemController = require('../src/controllers/documentItem.controller');
const knowledgeItemController = require('../src/controllers/knowledgeItem.controller');
const clientPortalController = require('../src/controllers/clientPortal.controller');
const docketEffortController = require('../src/controllers/docketEffort.controller');

const Team = require('../src/models/Team.model');
const Case = require('../src/models/Case.model');
const User = require('../src/models/User.model');
const DocumentItem = require('../src/models/DocumentItem.model');
const KnowledgeItem = require('../src/models/KnowledgeItem.model');
const DocketEffort = require('../src/models/DocketEffort.model');

const SECRET_SENSITIVE_ERROR = 'SQLITE_OR_MONGO_SYNTAX_ERROR: SELECT * FROM secrets WHERE private_key = "sensitive"';

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  return res;
}

let loggedErrors = [];
const originalLogError = log.error;

function setupLogSpy() {
  loggedErrors = [];
  log.error = (event, meta) => {
    loggedErrors.push({ event, meta });
  };
}

function restoreLogSpy() {
  log.error = originalLogError;
}

async function runTests() {
  setupLogSpy();
  const testObjectId = new mongoose.Types.ObjectId().toString();

  try {
    // 1. Capacity Controller
    console.log('Testing capacity.controller...');
    {
      const origFindOne = Team.findOne;
      Team.findOne = () => { throw new Error(SECRET_SENSITIVE_ERROR); };
      const req = { params: { workbasketId: testObjectId }, user: { firmId: testObjectId } };
      const res = mockRes();
      await capacityController.getWorkbasketCapacity(req, res);
      assert.strictEqual(res.statusCode, 500);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message, 'Failed to fetch workbasket capacity');
      assert.ok(!res.body.message.includes(SECRET_SENSITIVE_ERROR));
      const logEntry = loggedErrors.find(l => l.event === 'WORKBASKET_CAPACITY_FETCH_FAILED');
      assert.ok(logEntry);
      assert.strictEqual(logEntry.meta.message, SECRET_SENSITIVE_ERROR);
      Team.findOne = origFindOne;
    }

    {
      const origFind = Case.find;
      Case.find = () => { throw new Error(SECRET_SENSITIVE_ERROR); };
      const req = { params: { workbasketId: testObjectId }, query: {}, user: { firmId: testObjectId } };
      const res = mockRes();
      await capacityController.getWorkbasketDockets(req, res);
      assert.strictEqual(res.statusCode, 500);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message, 'Failed to fetch workbasket dockets');
      assert.ok(!res.body.message.includes(SECRET_SENSITIVE_ERROR));
      const logEntry = loggedErrors.find(l => l.event === 'WORKBASKET_DOCKETS_FETCH_FAILED');
      assert.ok(logEntry);
      assert.strictEqual(logEntry.meta.message, SECRET_SENSITIVE_ERROR);
      Case.find = origFind;
    }

    {
      const origFindOne = User.findOne;
      User.findOne = () => { throw new Error(SECRET_SENSITIVE_ERROR); };
      const req = { body: { caseIds: ['DCK-1'], assignedToXID: 'USR001' }, user: { firmId: testObjectId } };
      const res = mockRes();
      await capacityController.bulkReassignDockets(req, res);
      assert.strictEqual(res.statusCode, 500);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message, 'Failed to reassign dockets');
      assert.ok(!res.body.message.includes(SECRET_SENSITIVE_ERROR));
      const logEntry = loggedErrors.find(l => l.event === 'BULK_REASSIGN_DOCKETS_FAILED');
      assert.ok(logEntry);
      assert.strictEqual(logEntry.meta.message, SECRET_SENSITIVE_ERROR);
      User.findOne = origFindOne;
    }

    // 2. DocumentItem Controller
    console.log('Testing documentItem.controller...');
    {
      const origFindOne = Case.findOne;
      Case.findOne = () => { throw new Error(SECRET_SENSITIVE_ERROR); };
      const req = { body: { caseInternalId: testObjectId, name: 'Doc' }, user: { firmId: testObjectId, xID: 'X1' } };
      const res = mockRes();
      await documentItemController.createDocumentItem(req, res);
      assert.strictEqual(res.statusCode, 500);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message, 'Failed to create document item');
      assert.ok(!res.body.message.includes(SECRET_SENSITIVE_ERROR));
      const logEntry = loggedErrors.find(l => l.event === 'DOCUMENT_ITEM_CREATE_FAILED');
      assert.ok(logEntry);
      assert.strictEqual(logEntry.meta.message, SECRET_SENSITIVE_ERROR);
      Case.findOne = origFindOne;
    }

    {
      const origFindOne = DocumentItem.findOne;
      DocumentItem.findOne = () => { throw new Error(SECRET_SENSITIVE_ERROR); };
      const req = { params: { id: testObjectId }, body: {}, user: { firmId: testObjectId, xID: 'X1' } };
      const res = mockRes();
      await documentItemController.addDocumentVersion(req, res);
      assert.strictEqual(res.statusCode, 500);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message, 'Failed to upload document version');
      assert.ok(!res.body.message.includes(SECRET_SENSITIVE_ERROR));
      const logEntry = loggedErrors.find(l => l.event === 'DOCUMENT_VERSION_ADD_FAILED');
      assert.ok(logEntry);
      assert.strictEqual(logEntry.meta.message, SECRET_SENSITIVE_ERROR);
      DocumentItem.findOne = origFindOne;
    }

    {
      const origCount = DocumentItem.countDocuments;
      DocumentItem.countDocuments = () => { throw new Error(SECRET_SENSITIVE_ERROR); };
      const req = { query: {}, user: { firmId: testObjectId } };
      const res = mockRes();
      await documentItemController.getDocumentItems(req, res);
      assert.strictEqual(res.statusCode, 500);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message, 'Failed to fetch document items');
      assert.ok(!res.body.message.includes(SECRET_SENSITIVE_ERROR));
      const logEntry = loggedErrors.find(l => l.event === 'DOCUMENT_ITEMS_GET_FAILED');
      assert.ok(logEntry);
      assert.strictEqual(logEntry.meta.message, SECRET_SENSITIVE_ERROR);
      DocumentItem.countDocuments = origCount;
    }

    {
      const origFindOne = DocumentItem.findOne;
      DocumentItem.findOne = () => { throw new Error(SECRET_SENSITIVE_ERROR); };
      const req = { params: { id: testObjectId }, user: { firmId: testObjectId } };
      const res = mockRes();
      await documentItemController.getDocumentItemById(req, res);
      assert.strictEqual(res.statusCode, 500);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message, 'Failed to fetch document item');
      assert.ok(!res.body.message.includes(SECRET_SENSITIVE_ERROR));
      const logEntry = loggedErrors.find(l => l.event === 'DOCUMENT_ITEM_GET_FAILED');
      assert.ok(logEntry);
      assert.strictEqual(logEntry.meta.message, SECRET_SENSITIVE_ERROR);
      DocumentItem.findOne = origFindOne;
    }

    {
      const origFindOne = DocumentItem.findOne;
      DocumentItem.findOne = () => { throw new Error(SECRET_SENSITIVE_ERROR); };
      const req = { params: { id: testObjectId }, body: { status: 'approved' }, user: { firmId: testObjectId } };
      const res = mockRes();
      await documentItemController.updateDocumentStatus(req, res);
      assert.strictEqual(res.statusCode, 500);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message, 'Failed to update document status');
      assert.ok(!res.body.message.includes(SECRET_SENSITIVE_ERROR));
      const logEntry = loggedErrors.find(l => l.event === 'DOCUMENT_STATUS_UPDATE_FAILED');
      assert.ok(logEntry);
      assert.strictEqual(logEntry.meta.message, SECRET_SENSITIVE_ERROR);
      DocumentItem.findOne = origFindOne;
    }

    {
      const origFindOne = DocumentItem.findOne;
      DocumentItem.findOne = () => { throw new Error(SECRET_SENSITIVE_ERROR); };
      const req = { params: { id: testObjectId }, body: { versionNumber: 2 }, user: { firmId: testObjectId } };
      const res = mockRes();
      await documentItemController.selectCurrentVersion(req, res);
      assert.strictEqual(res.statusCode, 500);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message, 'Failed to select current version');
      assert.ok(!res.body.message.includes(SECRET_SENSITIVE_ERROR));
      const logEntry = loggedErrors.find(l => l.event === 'DOCUMENT_VERSION_SELECT_FAILED');
      assert.ok(logEntry);
      assert.strictEqual(logEntry.meta.message, SECRET_SENSITIVE_ERROR);
      DocumentItem.findOne = origFindOne;
    }

    // 3. KnowledgeItem Controller
    console.log('Testing knowledgeItem.controller...');
    {
      const origFind = KnowledgeItem.find;
      KnowledgeItem.find = () => { throw new Error(SECRET_SENSITIVE_ERROR); };
      const req = { query: {}, user: { firmId: testObjectId, role: 'ADMIN' } };
      const res = mockRes();
      await knowledgeItemController.listKnowledgeItems(req, res);
      assert.strictEqual(res.statusCode, 500);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message, 'Failed to list knowledge items');
      assert.ok(!res.body.message.includes(SECRET_SENSITIVE_ERROR));
      const logEntry = loggedErrors.find(l => l.event === 'KNOWLEDGE_ITEMS_LIST_FAILED');
      assert.ok(logEntry);
      assert.strictEqual(logEntry.meta.message, SECRET_SENSITIVE_ERROR);
      KnowledgeItem.find = origFind;
    }

    {
      const origFindOne = KnowledgeItem.findOne;
      KnowledgeItem.findOne = () => { throw new Error(SECRET_SENSITIVE_ERROR); };
      const req = { params: { id: testObjectId }, user: { firmId: testObjectId } };
      const res = mockRes();
      await knowledgeItemController.getKnowledgeItem(req, res);
      assert.strictEqual(res.statusCode, 500);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message, 'Failed to get knowledge item');
      assert.ok(!res.body.message.includes(SECRET_SENSITIVE_ERROR));
      const logEntry = loggedErrors.find(l => l.event === 'KNOWLEDGE_ITEM_FETCH_FAILED');
      assert.ok(logEntry);
      assert.strictEqual(logEntry.meta.message, SECRET_SENSITIVE_ERROR);
      KnowledgeItem.findOne = origFindOne;
    }

    {
      const origFindOne = Case.findOne;
      Case.findOne = () => { throw new Error(SECRET_SENSITIVE_ERROR); };
      const req = { params: { caseId: 'DCK-001' }, user: { firmId: testObjectId } };
      const res = mockRes();
      await knowledgeItemController.getWorkspaceAssets(req, res);
      assert.strictEqual(res.statusCode, 500);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message, 'Failed to retrieve workspace assets');
      assert.ok(!res.body.message.includes(SECRET_SENSITIVE_ERROR));
      const logEntry = loggedErrors.find(l => l.event === 'WORKSPACE_ASSETS_FETCH_FAILED');
      assert.ok(logEntry);
      assert.strictEqual(logEntry.meta.message, SECRET_SENSITIVE_ERROR);
      Case.findOne = origFindOne;
    }

    {
      const origFind = Case.find;
      Case.find = () => { throw new Error(SECRET_SENSITIVE_ERROR); };
      const req = { user: { firmId: testObjectId } };
      const res = mockRes();
      await knowledgeItemController.getFirmMemoryReports(req, res);
      assert.strictEqual(res.statusCode, 500);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message, 'Failed to generate firm memory reports');
      assert.ok(!res.body.message.includes(SECRET_SENSITIVE_ERROR));
      const logEntry = loggedErrors.find(l => l.event === 'FIRM_MEMORY_REPORTS_FAILED');
      assert.ok(logEntry);
      assert.strictEqual(logEntry.meta.message, SECRET_SENSITIVE_ERROR);
      Case.find = origFind;
    }

    // 4. ClientPortal Controller
    console.log('Testing clientPortal.controller...');
    {
      const origFind = Case.find;
      Case.find = () => { throw new Error(SECRET_SENSITIVE_ERROR); };
      const req = { query: {}, user: { firmId: testObjectId } };
      const res = mockRes();
      await clientPortalController.getClientStatusView(req, res);
      assert.strictEqual(res.statusCode, 500);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message, 'Failed to fetch client status view');
      assert.ok(!res.body.message.includes(SECRET_SENSITIVE_ERROR));
      const logEntry = loggedErrors.find(l => l.event === 'CLIENT_STATUS_VIEW_FETCH_FAILED');
      assert.ok(logEntry);
      assert.strictEqual(logEntry.meta.message, SECRET_SENSITIVE_ERROR);
      Case.find = origFind;
    }

    {
      const origFindOne = Case.findOne;
      Case.findOne = () => { throw new Error(SECRET_SENSITIVE_ERROR); };
      const req = { params: { caseId: 'DCK-001' }, user: { firmId: testObjectId } };
      const res = mockRes();
      await clientPortalController.getClientStatusViewByCaseId(req, res);
      assert.strictEqual(res.statusCode, 500);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message, 'Failed to fetch docket client status');
      assert.ok(!res.body.message.includes(SECRET_SENSITIVE_ERROR));
      const logEntry = loggedErrors.find(l => l.event === 'DOCKET_CLIENT_STATUS_FETCH_FAILED');
      assert.ok(logEntry);
      assert.strictEqual(logEntry.meta.message, SECRET_SENSITIVE_ERROR);
      Case.findOne = origFindOne;
    }

    // 5. DocketEffort Controller
    console.log('Testing docketEffort.controller...');
    {
      const origFindOne = Case.findOne;
      Case.findOne = () => { throw new Error(SECRET_SENSITIVE_ERROR); };
      const req = { body: { caseInternalId: testObjectId, minutes: 30 }, user: { firmId: testObjectId } };
      const res = mockRes();
      await docketEffortController.createDocketEffort(req, res);
      assert.strictEqual(res.statusCode, 500);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message, 'Failed to create effort log');
      assert.ok(!res.body.message.includes(SECRET_SENSITIVE_ERROR));
      const logEntry = loggedErrors.find(l => l.event === 'DOCKET_EFFORT_CREATE_FAILED');
      assert.ok(logEntry);
      assert.strictEqual(logEntry.meta.message, SECRET_SENSITIVE_ERROR);
      Case.findOne = origFindOne;
    }

    {
      const origCount = DocketEffort.countDocuments;
      DocketEffort.countDocuments = () => { throw new Error(SECRET_SENSITIVE_ERROR); };
      const req = { query: {}, user: { firmId: testObjectId } };
      const res = mockRes();
      await docketEffortController.getDocketEfforts(req, res);
      assert.strictEqual(res.statusCode, 500);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message, 'Failed to list effort entries');
      assert.ok(!res.body.message.includes(SECRET_SENSITIVE_ERROR));
      const logEntry = loggedErrors.find(l => l.event === 'DOCKET_EFFORTS_FETCH_FAILED');
      assert.ok(logEntry);
      assert.strictEqual(logEntry.meta.message, SECRET_SENSITIVE_ERROR);
      DocketEffort.countDocuments = origCount;
    }

    {
      const origFindOne = DocketEffort.findOne;
      DocketEffort.findOne = () => { throw new Error(SECRET_SENSITIVE_ERROR); };
      const req = { params: { id: testObjectId }, user: { firmId: testObjectId } };
      const res = mockRes();
      await docketEffortController.deleteDocketEffort(req, res);
      assert.strictEqual(res.statusCode, 500);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message, 'Failed to delete effort entry');
      assert.ok(!res.body.message.includes(SECRET_SENSITIVE_ERROR));
      const logEntry = loggedErrors.find(l => l.event === 'DOCKET_EFFORT_DELETE_FAILED');
      assert.ok(logEntry);
      assert.strictEqual(logEntry.meta.message, SECRET_SENSITIVE_ERROR);
      DocketEffort.findOne = origFindOne;
    }

    {
      const origFindOne = Case.findOne;
      Case.findOne = () => { throw new Error(SECRET_SENSITIVE_ERROR); };
      const req = { params: { caseId: 'DCK-001' }, body: { expectedMinutes: 60 }, user: { firmId: testObjectId } };
      const res = mockRes();
      await docketEffortController.updateDocketBudget(req, res);
      assert.strictEqual(res.statusCode, 500);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message, 'Failed to update docket budget profile');
      assert.ok(!res.body.message.includes(SECRET_SENSITIVE_ERROR));
      const logEntry = loggedErrors.find(l => l.event === 'DOCKET_BUDGET_UPDATE_FAILED');
      assert.ok(logEntry);
      assert.strictEqual(logEntry.meta.message, SECRET_SENSITIVE_ERROR);
      Case.findOne = origFindOne;
    }

    {
      const origFind = Case.find;
      Case.find = () => { throw new Error(SECRET_SENSITIVE_ERROR); };
      const req = { user: { firmId: testObjectId, role: 'ADMIN' } };
      const res = mockRes();
      await docketEffortController.getProfitabilityReports(req, res);
      assert.strictEqual(res.statusCode, 500);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.message, 'Failed to fetch profitability analytics reports');
      assert.ok(!res.body.message.includes(SECRET_SENSITIVE_ERROR));
      const logEntry = loggedErrors.find(l => l.event === 'PROFITABILITY_REPORTS_FETCH_FAILED');
      assert.ok(logEntry);
      assert.strictEqual(logEntry.meta.message, SECRET_SENSITIVE_ERROR);
      Case.find = origFind;
    }

    console.log('All 20 information exposure vulnerability tests passed successfully!');
  } finally {
    restoreLogSpy();
  }
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
