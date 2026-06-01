#!/usr/bin/env node
'use strict';

const assert = require('assert');
const mongoose = require('mongoose');

const EmailCapture = require('../src/models/EmailCapture.model');
const Client = require('../src/models/Client.model');
const Case = require('../src/models/Case.model');
const Comment = require('../src/models/Comment.model');
const CaseHistory = require('../src/models/CaseHistory.model');

const controllerPath = require.resolve('../src/controllers/emailCapture.controller');

function freshController() {
  delete require.cache[controllerPath];
  return require('../src/controllers/emailCapture.controller');
}

// 1. Verify successful creation and client restrictions
async function testCreateEmailCapture() {
  const originalFindClient = Client.findOne;
  const originalSave = EmailCapture.prototype.save;

  let savedData = null;
  EmailCapture.prototype.save = async function () {
    savedData = this;
    return this;
  };

  const clientMockId = new mongoose.Types.ObjectId();
  Client.findOne = () => ({
    lean: async () => ({
      _id: clientMockId,
      clientId: 'C000101',
    }),
  });

  const req = {
    body: {
      sender: { email: 'sender@example.com', name: 'Alice Smith' },
      subject: 'Urgent tax query',
      bodyExcerpt: 'Please find tax documents attached.',
      linkedClientId: clientMockId.toString(),
      classification: 'actionable',
    },
    user: {
      firmId: new mongoose.Types.ObjectId(),
      xID: 'X000001',
      restrictedClientIds: [],
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
    await controller.createEmailCapture(req, res);

    assert.strictEqual(jsonResult.success, true);
    assert.ok(savedData);
    assert.strictEqual(savedData.sender.email, 'sender@example.com');
    assert.strictEqual(savedData.subject, 'Urgent tax query');
    assert.strictEqual(String(savedData.linkedClientId), clientMockId.toString());

    // Test client restrictions (returns 403 Forbidden)
    req.user.restrictedClientIds = ['C000101'];
    let restrictedJson;
    const restrictedRes = {
      status: function (code) {
        this.statusCode = code;
        return this;
      },
      json: function (data) {
        restrictedJson = data;
        return this;
      },
    };

    await controller.createEmailCapture(req, restrictedRes);
    assert.strictEqual(restrictedRes.statusCode, 403);
    assert.strictEqual(restrictedJson.success, false);
    assert.strictEqual(restrictedJson.code, 'CLIENT_ACCESS_RESTRICTED');

    console.log('✓ Email capture creation and client restrictions verified');
  } finally {
    Client.findOne = originalFindClient;
    EmailCapture.prototype.save = originalSave;
  }
}

// 2. Verify list filtering, restricted client exclusions, and ageing follow-ups
async function testGetEmailCaptures() {
  const originalFindClient = Client.find;
  const originalFindCapture = EmailCapture.find;
  const originalCount = EmailCapture.countDocuments;

  const restrictedClientMockId = new mongoose.Types.ObjectId();
  Client.find = () => ({
    select: () => ({
      lean: async () => [{ _id: restrictedClientMockId }],
    }),
  });

  let capturedQuery = null;
  EmailCapture.find = (query) => {
    capturedQuery = query;
    return {
      sort: () => ({
        skip: () => ({
          limit: () => ({
            lean: async () => [
              { subject: 'Visible email', classification: 'actionable' },
            ],
          }),
        }),
      }),
    };
  };

  EmailCapture.countDocuments = async () => 1;

  const req = {
    query: {
      page: '1',
      limit: '10',
      ageing: 'true',
    },
    user: {
      firmId: new mongoose.Types.ObjectId(),
      restrictedClientIds: ['C000101'],
    },
  };

  let jsonResult;
  const res = {
    json: function (data) {
      jsonResult = data;
      return this;
    },
  };

  try {
    const controller = freshController();
    await controller.getEmailCaptures(req, res);

    assert.strictEqual(jsonResult.success, true);
    assert.strictEqual(jsonResult.data.length, 1);
    assert.strictEqual(jsonResult.data[0].subject, 'Visible email');

    // Assert strict client exclusions filter
    assert.ok(capturedQuery.linkedClientId);
    assert.ok(capturedQuery.linkedClientId.$nin);
    assert.strictEqual(String(capturedQuery.linkedClientId.$nin[0]), restrictedClientMockId.toString());

    // Assert ageing filters
    assert.ok(capturedQuery.$or);
    assert.strictEqual(capturedQuery.$or[1].classification.$in.length, 2);

    console.log('✓ Email capture list, client boundaries, and ageing filters verified');
  } finally {
    Client.find = originalFindClient;
    EmailCapture.find = originalFindCapture;
    EmailCapture.countDocuments = originalCount;
  }
}

// 3. Verify docket linking, Comments, and CaseHistory logs
async function testLinkToDocket() {
  const originalFindCapture = EmailCapture.findOne;
  const originalFindCase = Case.findOne;
  const originalFindClient = Client.findOne;
  const originalSaveCapture = EmailCapture.prototype.save;
  const originalCreateComment = Comment.create;
  const originalCreateHistory = CaseHistory.create;

  const captureMock = {
    _id: new mongoose.Types.ObjectId(),
    subject: 'Tax info',
    sender: { email: 'client@example.com' },
    save: async function () { return this; },
  };

  EmailCapture.findOne = () => captureMock;

  const caseMock = {
    caseInternalId: new mongoose.Types.ObjectId(),
    caseId: 'DCK-00020',
    caseNumber: 'DCK-00020',
    clientId: 'C000102',
  };

  Case.findOne = () => caseMock;

  Client.findOne = () => ({
    lean: async () => ({ _id: new mongoose.Types.ObjectId(), clientId: 'C000102' }),
  });

  let commentPayload = null;
  Comment.create = async function (payload) {
    commentPayload = payload;
    return payload;
  };

  let historyPayload = null;
  CaseHistory.create = async function (payload) {
    historyPayload = payload;
    return payload;
  };

  const req = {
    params: { id: captureMock._id.toString() },
    body: { caseInternalId: caseMock.caseInternalId.toString() },
    user: {
      firmId: new mongoose.Types.ObjectId(),
      email: 'manager@example.com',
      xID: 'X000001',
      role: 'MANAGER',
      restrictedClientIds: [],
    },
  };

  let jsonResult;
  const res = {
    json: function (data) {
      jsonResult = data;
      return this;
    },
  };

  try {
    const controller = freshController();
    await controller.linkToDocket(req, res);

    assert.strictEqual(jsonResult.success, true);
    assert.strictEqual(String(captureMock.linkedCaseInternalId), caseMock.caseInternalId.toString());

    // Assert that a Comment was posted to the docket
    assert.ok(commentPayload);
    assert.strictEqual(commentPayload.caseId, 'DCK-00020');
    assert.match(commentPayload.text, /Linked manually captured email/);

    // Assert that a CaseHistory log was recorded
    assert.ok(historyPayload);
    assert.strictEqual(historyPayload.actionType, 'EmailLinked');
    assert.strictEqual(historyPayload.performedByXID, 'X000001');

    console.log('✓ Docket linking, comments placement, and case history logging verified');
  } finally {
    EmailCapture.findOne = originalFindCapture;
    Case.findOne = originalFindCase;
    Client.findOne = originalFindClient;
    EmailCapture.prototype.save = originalSaveCapture;
    Comment.create = originalCreateComment;
    CaseHistory.create = originalCreateHistory;
  }
}

// 4. Verify spawning new docket from email capture
async function testCreateDocketFromEmail() {
  const originalFindCapture = EmailCapture.findOne;
  const originalFindClient = Client.findOne;
  const originalSaveCase = Case.prototype.save;
  const originalSaveCapture = EmailCapture.prototype.save;
  const originalCreateComment = Comment.create;
  const originalCreateHistory = CaseHistory.create;

  const clientMockId = new mongoose.Types.ObjectId();
  const captureMock = {
    _id: new mongoose.Types.ObjectId(),
    subject: 'Annual tax filing',
    bodyExcerpt: 'Please find tax documents attached.',
    sender: { email: 'client@example.com' },
    linkedClientId: clientMockId,
    save: async function () { return this; },
  };

  EmailCapture.findOne = () => captureMock;

  Client.findOne = () => ({
    clientId: 'C000102',
  });

  let savedCase = null;
  Case.prototype.save = async function () {
    this.caseId = 'DCK-00021';
    this.caseNumber = 'DCK-00021';
    savedCase = this;
    return this;
  };

  let commentPayload = null;
  Comment.create = async function (payload) {
    commentPayload = payload;
    return payload;
  };

  let historyPayload = null;
  CaseHistory.create = async function (payload) {
    historyPayload = payload;
    return payload;
  };

  const req = {
    params: { id: captureMock._id.toString() },
    body: {
      title: 'Tax filings 2026',
      categoryId: new mongoose.Types.ObjectId().toString(),
      subcategoryId: 'SUB-101',
      priority: 'high',
    },
    user: {
      firmId: new mongoose.Types.ObjectId(),
      email: 'manager@example.com',
      xID: 'X000001',
      role: 'MANAGER',
      restrictedClientIds: [],
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
    await controller.createDocketFromEmail(req, res);

    assert.strictEqual(res.statusCode, 201);
    assert.ok(savedCase);
    assert.strictEqual(savedCase.title, 'Tax filings 2026');
    assert.strictEqual(savedCase.priority, 'high');
    assert.strictEqual(savedCase.clientId, 'C000102');

    // Assert that capture record links to new case Display ID and Internal ID
    assert.strictEqual(captureMock.linkedCaseId, 'DCK-00021');

    // Assert that comment and history logs are posted
    assert.ok(commentPayload);
    assert.match(commentPayload.text, /Docket spawned from manually captured email/);

    assert.ok(historyPayload);
    assert.strictEqual(historyPayload.actionType, 'Created');
    assert.match(historyPayload.description, /filing/);

    console.log('✓ Docket spawning from email capture, comments, and audit trails verified');
  } finally {
    EmailCapture.findOne = originalFindCapture;
    Client.findOne = originalFindClient;
    Case.prototype.save = originalSaveCase;
    EmailCapture.prototype.save = originalSaveCapture;
    Comment.create = originalCreateComment;
    CaseHistory.create = originalCreateHistory;
  }
}

async function run() {
  console.log('Running Email Capture V1 integration tests...');
  try {
    await testCreateEmailCapture();
    await testGetEmailCaptures();
    await testLinkToDocket();
    await testCreateDocketFromEmail();
    console.log('All Email Capture V1 integration tests passed successfully!');
  } catch (error) {
    console.error('Email Capture V1 tests failed:', error);
    process.exit(1);
  }
}

run();
