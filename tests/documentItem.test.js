#!/usr/bin/env node
'use strict';

const assert = require('assert');
const mongoose = require('mongoose');

const DocumentItem = require('../src/models/DocumentItem.model');
const Client = require('../src/models/Client.model');
const Case = require('../src/models/Case.model');
const Attachment = require('../src/models/Attachment.model');
const Comment = require('../src/models/Comment.model');
const CaseHistory = require('../src/models/CaseHistory.model');

const controllerPath = require.resolve('../src/controllers/documentItem.controller');

function freshController() {
  delete require.cache[controllerPath];
  return require('../src/controllers/documentItem.controller');
}

// 1. Verify document item creation, client restrictions, and duplicate prevention
async function testCreateDocumentItem() {
  const originalFindCase = Case.findOne;
  const originalFindAttachment = Attachment.findOne;
  const originalFindClient = Client.findOne;
  const originalFindDocItem = DocumentItem.findOne;
  const originalSave = DocumentItem.prototype.save;
  const originalCreateComment = Comment.create;
  const originalCreateHistory = CaseHistory.create;

  let savedData = null;
  DocumentItem.prototype.save = async function () {
    savedData = this;
    return this;
  };

  const caseMockId = new mongoose.Types.ObjectId();
  const attachmentMockId = new mongoose.Types.ObjectId();
  const clientMockId = new mongoose.Types.ObjectId();

  Case.findOne = () => ({
    caseInternalId: caseMockId,
    caseId: 'DCK-00030',
    caseNumber: 'DCK-00030',
    clientId: 'C000103',
  });

  Attachment.findOne = () => ({
    _id: attachmentMockId,
    fileName: 'board_resolution_final.pdf',
  });

  Client.findOne = () => ({
    lean: async () => ({ _id: clientMockId, clientId: 'C000103' }),
  });

  let findDocQuery = null;
  DocumentItem.findOne = (query) => {
    findDocQuery = query;
    return null; // No duplicate initially
  };

  Comment.create = async (payload) => payload;
  CaseHistory.create = async (payload) => payload;

  const req = {
    body: {
      caseInternalId: caseMockId.toString(),
      name: 'Board Resolution 2026',
      category: 'legal',
      fileReference: attachmentMockId.toString(),
      notes: 'Initial board resolution',
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
    await controller.createDocumentItem(req, res);

    assert.strictEqual(res.statusCode, 201);
    assert.ok(savedData);
    assert.strictEqual(savedData.name, 'Board Resolution 2026');
    assert.strictEqual(savedData.versions.length, 1);
    assert.strictEqual(savedData.versions[0].versionNumber, 1);
    assert.strictEqual(String(savedData.versions[0].fileReference), attachmentMockId.toString());

    // Test client restrictions (returns 403 Forbidden)
    req.user.restrictedClientIds = ['C000103'];
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

    await controller.createDocumentItem(req, restrictedRes);
    assert.strictEqual(restrictedRes.statusCode, 403);
    assert.strictEqual(restrictedJson.success, false);
    assert.strictEqual(restrictedJson.code, 'CLIENT_ACCESS_RESTRICTED');

    // Test Duplicate Name Conflict (returns 409 Conflict)
    req.user.restrictedClientIds = [];
    DocumentItem.findOne = () => ({ _id: new mongoose.Types.ObjectId() }); // Pretend duplicate exists
    let duplicateJson;
    const duplicateRes = {
      status: function (code) {
        this.statusCode = code;
        return this;
      },
      json: function (data) {
        duplicateJson = data;
        return this;
      },
    };

    await controller.createDocumentItem(req, duplicateRes);
    assert.strictEqual(duplicateRes.statusCode, 409);
    assert.strictEqual(duplicateJson.success, false);
    assert.match(duplicateJson.message, /already exists/);

    console.log('✓ Document pack creation, client visibility, and duplicate checks verified');
  } finally {
    Case.findOne = originalFindCase;
    Attachment.findOne = originalFindAttachment;
    Client.findOne = originalFindClient;
    DocumentItem.findOne = originalFindDocItem;
    DocumentItem.prototype.save = originalSave;
    Comment.create = originalCreateComment;
    CaseHistory.create = originalCreateHistory;
  }
}

// 2. Verify uploading a new document version and version count increments
async function testAddDocumentVersion() {
  const originalFindDocItem = DocumentItem.findOne;
  const originalFindCase = Case.findOne;
  const originalFindAttachment = Attachment.findOne;
  const originalSave = DocumentItem.prototype.save;
  const originalCreateComment = Comment.create;
  const originalCreateHistory = CaseHistory.create;

  const caseMockId = new mongoose.Types.ObjectId();
  const file1 = new mongoose.Types.ObjectId();
  const file2 = new mongoose.Types.ObjectId();

  const docItemMock = {
    _id: new mongoose.Types.ObjectId(),
    caseInternalId: caseMockId,
    name: 'Tax filings',
    versions: [
      {
        versionNumber: 1,
        fileReference: file1,
        uploadedByXID: 'X000001',
        uploadedAt: new Date(),
        changeNote: 'Initial',
      },
    ],
    save: async function () { return this; },
  };

  DocumentItem.findOne = () => docItemMock;

  Case.findOne = () => ({
    caseId: 'DCK-00030',
    caseNumber: 'DCK-00030',
    clientId: 'C000103',
  });

  Attachment.findOne = () => ({
    _id: file2,
    fileName: 'tax_filing_revised.pdf',
  });

  let commentPayload = null;
  Comment.create = async (payload) => {
    commentPayload = payload;
    return payload;
  };

  let historyPayload = null;
  CaseHistory.create = async (payload) => {
    historyPayload = payload;
    return payload;
  };

  const req = {
    params: { id: docItemMock._id.toString() },
    body: {
      fileReference: file2.toString(),
      changeNote: 'Revised audit figures',
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
    await controller.addDocumentVersion(req, res);

    assert.strictEqual(jsonResult.success, true);
    assert.strictEqual(docItemMock.versions.length, 2);
    assert.strictEqual(docItemMock.versions[1].versionNumber, 2);
    assert.strictEqual(String(docItemMock.versions[1].fileReference), file2.toString());
    assert.strictEqual(docItemMock.currentVersionNumber, 2);

    // Assert comment and history logging
    assert.ok(commentPayload);
    assert.match(commentPayload.text, /Version 2/);
    assert.ok(historyPayload);
    assert.strictEqual(historyPayload.actionType, 'DocumentAttached');

    console.log('✓ Document version increments, comment posting, and audit history verified');
  } finally {
    DocumentItem.findOne = originalFindDocItem;
    Case.findOne = originalFindCase;
    Attachment.findOne = originalFindAttachment;
    DocumentItem.prototype.save = originalSave;
    Comment.create = originalCreateComment;
    CaseHistory.create = originalCreateHistory;
  }
}

// 3. Verify status updates, version selections, and audit trail preservation on Approved/Filed
async function testUpdateStatusAndSelectVersion() {
  const originalFindDocItem = DocumentItem.findOne;
  const originalFindCase = Case.findOne;
  const originalSave = DocumentItem.prototype.save;
  const originalCreateComment = Comment.create;
  const originalCreateHistory = CaseHistory.create;

  const caseMockId = new mongoose.Types.ObjectId();
  const file1 = new mongoose.Types.ObjectId();

  const docItemMock = {
    _id: new mongoose.Types.ObjectId(),
    caseInternalId: caseMockId,
    name: 'Audit Statement',
    status: 'draft',
    currentVersionNumber: 1,
    versions: [
      { versionNumber: 1, fileReference: file1 },
      { versionNumber: 2, fileReference: new mongoose.Types.ObjectId() },
    ],
    save: async function () { return this; },
  };

  DocumentItem.findOne = () => docItemMock;

  Case.findOne = () => ({
    caseId: 'DCK-00030',
    caseNumber: 'DCK-00030',
    clientId: 'C000103',
  });

  let historyPayloads = [];
  CaseHistory.create = async (payload) => {
    historyPayloads.push(payload);
    return payload;
  };

  Comment.create = async (payload) => payload;

  const req = {
    params: { id: docItemMock._id.toString() },
    body: { status: 'approved' },
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
    await controller.updateDocumentStatus(req, res);

    assert.strictEqual(jsonResult.success, true);
    assert.strictEqual(docItemMock.status, 'approved');

    // Assert Approved CaseHistory Audit trail created
    assert.strictEqual(historyPayloads.length, 1);
    assert.strictEqual(historyPayloads[0].actionType, 'Approved');
    assert.match(historyPayloads[0].description, /approved/);

    // Test active version selection switch
    req.body = { versionNumber: 2 };
    let versionJson;
    const versionRes = {
      json: function (data) {
        versionJson = data;
        return this;
      },
    };

    await controller.selectCurrentVersion(req, versionRes);
    assert.strictEqual(versionJson.success, true);
    assert.strictEqual(docItemMock.currentVersionNumber, 2);

    // Assert change active version CaseHistory log created
    assert.strictEqual(historyPayloads.length, 2);
    assert.strictEqual(historyPayloads[1].actionLabel, 'Document Active Version Changed');

    console.log('✓ Document status transitions, version selection switches, and audit trail preservation verified');
  } finally {
    DocumentItem.findOne = originalFindDocItem;
    Case.findOne = originalFindCase;
    DocumentItem.prototype.save = originalSave;
    Comment.create = originalCreateComment;
    CaseHistory.create = originalCreateHistory;
  }
}

async function run() {
  console.log('Running Document Version Control integration tests...');
  try {
    await testCreateDocumentItem();
    await testAddDocumentVersion();
    await testUpdateStatusAndSelectVersion();
    console.log('All Document Version Control integration tests passed successfully!');
  } catch (error) {
    console.error('Document Version Control tests failed:', error);
    process.exit(1);
  }
}

run();
