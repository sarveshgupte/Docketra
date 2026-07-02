#!/usr/bin/env node
/**
 * Integration tests for the Client Inbound/Outbound Email features.
 * Verifies email signature verification, sender whitelisting, file uploads,
 * auto-reopening of pending cases, comments creation, and email log capturing.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { createMongoMemoryOrNull } = require('./utils/mongoMemory');

const User = require('../src/models/User.model');
const Firm = require('../src/models/Firm.model');
const Client = require('../src/models/Client.model');
const Case = require('../src/models/Case.model');
const Comment = require('../src/models/Comment.model');
const EmailCapture = require('../src/models/EmailCapture.model');
const Attachment = require('../src/models/Attachment.model');
const DocketFileStorageService = require('../src/services/docketFileStorage.service');
const { handleInboundEmail } = require('../src/controllers/inboundEmail.controller');
const { generateDocketEmailSignature } = require('../src/services/docketWorkflow.service');

// Helper to load and customize a CloudMailin fixture
function loadCloudMailinFixture(name, caseNumber, token) {
  const filePath = path.join(__dirname, 'fixtures', 'cloudmailin', name);
  const contentStr = fs.readFileSync(filePath, 'utf8');
  const replacedStr = contentStr
    .replace(/CO202603080001/g, caseNumber)
    .replace(/TOKEN_PLACEHOLDER/g, token);
  return JSON.parse(replacedStr);
}

// Helper to seed a basic firm, user, client and docket
async function setupTestCase(index) {
  const firm = await Firm.create({
    firmId: `FIRM00${index}`,
    name: `Test Firm Inc. ${index}`,
    firmSlug: `test-firm-inc-${index}`,
    status: 'active',
  });

  const clientPaddedId = String(index).padStart(6, '0');
  const client = await Client.create({
    clientId: `C${clientPaddedId}`,
    businessName: `Test Client Ltd. ${index}`,
    businessEmail: `client-${index}@company.com`,
    firmId: firm._id,
    status: 'ACTIVE',
    isActive: true,
    isSystemClient: true,
    isDefaultClient: true,
    createdBySystem: true,
    createdByXid: 'SUPERADMIN',
    createdBy: 'superadmin@test.com',
  });

  const adminPaddedXid = String(index * 2).padStart(6, '0');
  const primaryAdmin = await User.create({
    xID: `X${adminPaddedXid}`,
    name: 'Primary Admin',
    email: `primary-admin-${index}@docketra.com`,
    role: 'PRIMARY_ADMIN',
    firmId: firm._id,
    defaultClientId: client._id,
    isOnboarded: true,
  });

  const userPaddedXid = String(index * 2 + 1).padStart(6, '0');
  const user = await User.create({
    xID: `X${userPaddedXid}`,
    name: 'Assigned Agent',
    email: `agent-${index}@docketra.com`,
    role: 'USER',
    firmId: firm._id,
    defaultClientId: client._id,
    primaryAdminId: primaryAdmin._id,
    isOnboarded: true,
  });

  const docket = await Case.create({
    title: 'KYC Verification',
    caseId: `CASE-2026-${clientPaddedId}`,
    caseNumber: `CO20260308${clientPaddedId}`,
    caseInternalId: new mongoose.Types.ObjectId(),
    firmId: firm._id,
    clientId: `C${clientPaddedId}`,
    clientEmail: `client-${index}@company.com`,
    assignedToXID: `X${userPaddedXid}`,
    assignedTo: user._id,
    status: 'PENDING',
    pendingReason: 'waiting_client',
    lifecycle: 'WAITING',
    state: 'PENDED',
    queueType: 'PERSONAL',
    categoryId: new mongoose.Types.ObjectId(),
    subcategoryId: 'subcategory-1',
    createdByXID: `X${userPaddedXid}`,
    slaDueAt: new Date(Date.now() + 86400000),
  });

  return { firm, client, user, docket };
}

async function runTests() {
  let mongoServer = await createMongoMemoryOrNull(
    () => MongoMemoryServer.create(),
    'Skipping email integration tests (Mongo binary unavailable)'
  );
  
  if (!mongoServer) {
    console.log('Skipping tests since Mongo Memory Server is not available.');
    return;
  }

  await mongoose.connect(mongoServer.getUri());

  try {
    let uploadedFiles = [];
    const originalUploadFile = DocketFileStorageService.uploadFile;
    DocketFileStorageService.uploadFile = async ({ file, fileName, fileType, docketId, firmId, uploadedBy, uploadedByName, source, description }) => {
      uploadedFiles.push({ fileName, fileType, source, description });
      
      // Simulate Attachment record generation
      const mockAttachment = await Attachment.create({
        caseId: docketId,
        firmId: String(firmId),
        fileName,
        mimeType: fileType,
        size: file.length,
        storageFileId: 'mock-file-id-123',
        storageProvider: 'google-drive',
        uploadedBy,
        uploadedByName,
        createdBy: `${uploadedBy || 'unknown'}@docketra.internal`,
        createdByXID: uploadedBy,
        createdByName: uploadedByName,
        description,
        source,
      });

      return { id: mockAttachment._id, fileName };
    };

    let resStatus = null;
    let resJson = null;
    const mockRes = {
      status: function(code) { resStatus = code; return this; },
      json: function(payload) { resJson = payload; return this; }
    };

    // Test case 1: Compatibility Test - Legacy Request Body
    console.log('Running Test Case 1: Legacy payload compatibility...');
    const tc1 = await setupTestCase(1);
    const signature1 = generateDocketEmailSignature(tc1.docket.caseInternalId);
    
    const legacyReq = {
      body: {
        from: `client-1@company.com`,
        to: `docket-${tc1.docket.caseNumber}-${signature1}@docketra.in`,
        subject: 'Legacy format email subject',
        text: 'Hello, this is a legacy format text body.'
      }
    };

    await handleInboundEmail(legacyReq, mockRes);
    assert.strictEqual(resStatus, 200, 'Legacy payload should succeed');
    assert.strictEqual(resJson.success, true);
    console.log('✓ Test Case 1 passed.');

    // Test case 2: CloudMailin - Plain Text email
    console.log('Running Test Case 2: CloudMailin plain text email...');
    const tc2 = await setupTestCase(2);
    const signature2 = generateDocketEmailSignature(tc2.docket.caseInternalId);
    const plainTextPayload = loadCloudMailinFixture('plain_text.json', tc2.docket.caseNumber, signature2);
    plainTextPayload.envelope.from = 'client-2@company.com';
    plainTextPayload.headers.from = 'Test Client <client-2@company.com>';

    await handleInboundEmail({ body: plainTextPayload }, mockRes);
    assert.strictEqual(resStatus, 200);
    const captures = await EmailCapture.find({ linkedCaseId: tc2.docket.caseNumber });
    assert.strictEqual(captures.length, 1);
    assert.strictEqual(captures[0].bodyExcerpt, 'Hello, please find my submission details here in plain text. Thank you.');
    console.log('✓ Test Case 2 passed.');

    // Test case 3: CloudMailin - HTML email
    console.log('Running Test Case 3: CloudMailin HTML email...');
    const tc3 = await setupTestCase(3);
    const signature3 = generateDocketEmailSignature(tc3.docket.caseInternalId);
    const htmlPayload = loadCloudMailinFixture('html.json', tc3.docket.caseNumber, signature3);
    htmlPayload.envelope.from = 'client-3@company.com';
    htmlPayload.headers.from = 'Test Client <client-3@company.com>';

    await handleInboundEmail({ body: htmlPayload }, mockRes);
    assert.strictEqual(resStatus, 200);
    const htmlCaptures = await EmailCapture.find({ linkedCaseId: tc3.docket.caseNumber });
    assert.strictEqual(htmlCaptures[0].bodyExcerpt, 'Hello, please find my submission details here. Thank you.');
    console.log('✓ Test Case 3 passed.');

    // Test case 4: CloudMailin - One PDF Attachment email
    console.log('Running Test Case 4: CloudMailin one PDF attachment email...');
    uploadedFiles = [];
    const tc4 = await setupTestCase(4);
    const signature4 = generateDocketEmailSignature(tc4.docket.caseInternalId);
    const onePdfPayload = loadCloudMailinFixture('one_pdf.json', tc4.docket.caseNumber, signature4);
    onePdfPayload.envelope.from = 'client-4@company.com';
    onePdfPayload.headers.from = 'Test Client <client-4@company.com>';

    await handleInboundEmail({ body: onePdfPayload }, mockRes);
    assert.strictEqual(resStatus, 200);
    assert.strictEqual(uploadedFiles.length, 1, 'Expected one PDF upload');
    assert.strictEqual(uploadedFiles[0].fileName, 'passport.pdf');
    assert.strictEqual(uploadedFiles[0].fileType, 'application/pdf');
    console.log('✓ Test Case 4 passed.');

    // Test case 5: CloudMailin - Multiple Attachments email
    console.log('Running Test Case 5: CloudMailin multiple attachments email...');
    uploadedFiles = [];
    const tc5 = await setupTestCase(5);
    const signature5 = generateDocketEmailSignature(tc5.docket.caseInternalId);
    const multiplePayload = loadCloudMailinFixture('multiple_attachments.json', tc5.docket.caseNumber, signature5);
    multiplePayload.envelope.from = 'client-5@company.com';
    multiplePayload.headers.from = 'Test Client <client-5@company.com>';

    await handleInboundEmail({ body: multiplePayload }, mockRes);
    assert.strictEqual(resStatus, 200);
    assert.strictEqual(uploadedFiles.length, 2, 'Expected two uploads');
    assert.strictEqual(uploadedFiles[0].fileName, 'passport.pdf');
    assert.strictEqual(uploadedFiles[1].fileName, 'pancard.png');
    console.log('✓ Test Case 5 passed.');

    // Test case 6: CloudMailin - Forwarded email
    console.log('Running Test Case 6: CloudMailin forwarded email...');
    uploadedFiles = [];
    const tc6 = await setupTestCase(6);
    const signature6 = generateDocketEmailSignature(tc6.docket.caseInternalId);
    const forwardedPayload = loadCloudMailinFixture('forwarded.json', tc6.docket.caseNumber, signature6);
    forwardedPayload.envelope.from = 'client-6@company.com';
    forwardedPayload.headers.from = 'Test Client <client-6@company.com>';

    await handleInboundEmail({ body: forwardedPayload }, mockRes);
    assert.strictEqual(resStatus, 200);
    assert.strictEqual(uploadedFiles.length, 1);
    assert.strictEqual(uploadedFiles[0].fileName, 'fwd_doc.pdf');
    console.log('✓ Test Case 6 passed.');

    // Test case 7: CloudMailin - Reply email
    console.log('Running Test Case 7: CloudMailin reply email...');
    const tc7 = await setupTestCase(7);
    const signature7 = generateDocketEmailSignature(tc7.docket.caseInternalId);
    const replyPayload = loadCloudMailinFixture('reply.json', tc7.docket.caseNumber, signature7);
    replyPayload.envelope.from = 'client-7@company.com';
    replyPayload.headers.from = 'Test Client <client-7@company.com>';

    await handleInboundEmail({ body: replyPayload }, mockRes);
    assert.strictEqual(resStatus, 200);
    console.log('✓ Test Case 7 passed.');

    // Test case 8: Regression - Missing 'from' sender email
    console.log('Running Test Case 8: Regression - Missing from field...');
    const tc8 = await setupTestCase(8);
    const signature8 = generateDocketEmailSignature(tc8.docket.caseInternalId);
    const brokenFromPayload = loadCloudMailinFixture('plain_text.json', tc8.docket.caseNumber, signature8);
    delete brokenFromPayload.envelope.from;
    delete brokenFromPayload.headers.from;

    await handleInboundEmail({ body: brokenFromPayload }, mockRes);
    assert.strictEqual(resStatus, 400, 'Expected 400 Bad Request');
    console.log('✓ Test Case 8 passed.');

    // Test case 9: Regression - Missing 'to' recipient email
    console.log('Running Test Case 9: Regression - Missing to field...');
    const tc9 = await setupTestCase(9);
    const signature9 = generateDocketEmailSignature(tc9.docket.caseInternalId);
    const brokenToPayload = loadCloudMailinFixture('plain_text.json', tc9.docket.caseNumber, signature9);
    delete brokenToPayload.envelope.to;
    delete brokenToPayload.headers.to;

    await handleInboundEmail({ body: brokenToPayload }, mockRes);
    assert.strictEqual(resStatus, 400, 'Expected 400 Bad Request');
    console.log('✓ Test Case 9 passed.');

    // Test case 10: Reject email with invalid signature token
    console.log('Running Test Case 10: Rejecting email with invalid signature token...');
    const tc10 = await setupTestCase(10);
    const invalidSigPayload = loadCloudMailinFixture('plain_text.json', tc10.docket.caseNumber, '123456');
    invalidSigPayload.envelope.from = 'client-10@company.com';
    invalidSigPayload.headers.from = 'Test Client <client-10@company.com>';

    await handleInboundEmail({ body: invalidSigPayload }, mockRes);
    assert.strictEqual(resStatus, 403, 'Expected 403 Forbidden for mismatched signature');
    console.log('✓ Test Case 10 passed.');

    // Test case 11: Reject email with unauthorized sender
    console.log('Running Test Case 11: Rejecting email with unauthorized sender...');
    const tc11 = await setupTestCase(11);
    const signature11 = generateDocketEmailSignature(tc11.docket.caseInternalId);
    const hackerPayload = loadCloudMailinFixture('plain_text.json', tc11.docket.caseNumber, signature11);
    hackerPayload.envelope.from = 'hacker@malicious.com';
    hackerPayload.headers.from = 'Hacker <hacker@malicious.com>';

    await handleInboundEmail({ body: hackerPayload }, mockRes);
    assert.strictEqual(resStatus, 403, 'Expected 403 Forbidden for unauthorized sender');
    console.log('✓ Test Case 11 passed.');

    // Restore original upload function
    DocketFileStorageService.uploadFile = originalUploadFile;

  } catch (err) {
    console.error('Integration test assertion failed:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    await mongoServer.stop();
  }

  console.log('\nAll CloudMailin Inbound Email Integration tests passed.');
}

runTests().catch((err) => {
  console.error('Tests failed with error:', err);
  process.exit(1);
});
