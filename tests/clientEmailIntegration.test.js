#!/usr/bin/env node
/**
 * Integration tests for the Client Inbound/Outbound Email features.
 * Verifies email signature verification, sender whitelisting, file uploads,
 * auto-reopening of pending cases, comments creation, and email log capturing.
 */

const assert = require('assert');
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

// Helper to seed a basic firm, user, client and docket
async function setupTestCase() {
  const firm = await Firm.create({
    firmId: 'FIRM001',
    name: 'Test Firm Inc.',
    firmSlug: 'test-firm-inc',
    status: 'active',
  });

  const client = await Client.create({
    clientId: 'C000001',
    businessName: 'Test Client Ltd.',
    businessEmail: 'client@company.com',
    firmId: firm._id,
    status: 'ACTIVE',
    isActive: true,
    isSystemClient: true,
    isDefaultClient: true,
    createdBySystem: true,
    createdByXid: 'SUPERADMIN',
    createdBy: 'superadmin@test.com',
  });

  const primaryAdmin = await User.create({
    xID: 'X000122',
    name: 'Primary Admin',
    email: 'primary-admin@docketra.com',
    role: 'PRIMARY_ADMIN',
    firmId: firm._id,
    defaultClientId: client._id,
    isOnboarded: true,
  });

  const user = await User.create({
    xID: 'X000123',
    name: 'Assigned Agent',
    email: 'agent@docketra.com',
    role: 'USER',
    firmId: firm._id,
    defaultClientId: client._id,
    primaryAdminId: primaryAdmin._id,
    isOnboarded: true,
  });

  const docket = await Case.create({
    title: 'KYC Verification',
    caseId: 'CASE-2026-0001',
    caseNumber: 'CO202603080001',
    caseInternalId: new mongoose.Types.ObjectId(),
    firmId: firm._id,
    clientId: 'C000001',
    clientEmail: 'client@company.com',
    assignedToXID: 'X000123',
    assignedTo: user._id,
    status: 'PENDING',
    pendingReason: 'waiting_client',
    lifecycle: 'WAITING',
    state: 'PENDED',
    queueType: 'PERSONAL',
    categoryId: new mongoose.Types.ObjectId(),
    subcategoryId: 'subcategory-1',
    createdByXID: 'X000123',
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
    const { firm, client, user, docket } = await setupTestCase();
    const caseNumber = docket.caseNumber;
    const signature = generateDocketEmailSignature(docket.caseInternalId);
    
    // Mock the uploadFile service function to avoid making real network requests to storage providers
    const uploadedFiles = [];
    const originalUploadFile = DocketFileStorageService.uploadFile;
    DocketFileStorageService.uploadFile = async ({ file, fileName, fileType, docketId, firmId, uploadedBy, uploadedByName, source, description }) => {
      uploadedFiles.push({ fileName, fileType, source, description });
      
      // Simulate Attachment record generation
      const mockAttachment = await Attachment.create({
        caseId: docket.caseId,
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

    // Test case 1: Successful Inbound Email Processing
    console.log('Running Test Case 1: Processing a valid inbound email...');
    const req1 = {
      body: {
        from: 'client@company.com',
        to: `docket-${caseNumber}-${signature}@docketra.in`,
        subject: 'Here are the requested KYC docs',
        text: 'Hello, please find my KYC document attached. Thanks.',
        attachments: [
          {
            filename: 'passport.pdf',
            mimeType: 'application/pdf',
            content: Buffer.from('mock pdf content').toString('base64'),
          }
        ]
      }
    };
    
    let responseStatus1 = null;
    let responseJson1 = null;
    const res1 = {
      status: function(code) {
        responseStatus1 = code;
        return this;
      },
      json: function(payload) {
        responseJson1 = payload;
        return this;
      }
    };

    await handleInboundEmail(req1, res1);

    assert.strictEqual(responseStatus1, 200, 'Expected 200 OK status code');
    assert.strictEqual(responseJson1.success, true, 'Expected payload success to be true');
    assert.strictEqual(responseJson1.data.reopened, true, 'Expected case to be reopened');
    assert.strictEqual(responseJson1.data.attachmentsUploaded, 1, 'Expected 1 attachment uploaded');

    // Verify docket status was updated
    const updatedDocket = await Case.findById(docket._id);
    assert.strictEqual(updatedDocket.status, 'IN_PROGRESS', 'Expected case status to update to IN_PROGRESS');
    assert.strictEqual(updatedDocket.lifecycle, 'ACTIVE', 'Expected case lifecycle to update to ACTIVE');

    // Verify comment was generated
    const comments = await Comment.find({ caseId: docket.caseId });
    assert.strictEqual(comments.length, 1, 'Expected 1 comment to be logged');
    assert.ok(comments[0].text.includes('passport.pdf'), 'Comment text should list attachment name');

    // Verify email capture record was written
    const captures = await EmailCapture.find({ linkedCaseId: docket.caseNumber });
    assert.strictEqual(captures.length, 1, 'Expected 1 email capture record');
    assert.strictEqual(captures[0].subject, 'Here are the requested KYC docs');
    assert.strictEqual(captures[0].classification, 'actionable');

    console.log('✓ Test Case 1 passed.');

    // Test case 2: Reject email with invalid signature token
    console.log('Running Test Case 2: Rejecting email with invalid signature token...');
    const req2 = {
      body: {
        from: 'client@company.com',
        to: `docket-${caseNumber}-123456@docketra.in`,
        subject: 'KYC Document retry',
        text: 'Retrying with invalid sig.',
      }
    };
    
    let responseStatus2 = null;
    const res2 = {
      status: function(code) {
        responseStatus2 = code;
        return this;
      },
      json: function(payload) { return this; }
    };

    await handleInboundEmail(req2, res2);
    assert.strictEqual(responseStatus2, 403, 'Expected 403 Forbidden for mismatched signature');
    console.log('✓ Test Case 2 passed.');

    // Test case 3: Reject email with unauthorized sender
    console.log('Running Test Case 3: Rejecting email with unauthorized sender...');
    const req3 = {
      body: {
        from: 'hacker@malicious.com',
        to: `docket-${caseNumber}-${signature}@docketra.in`,
        subject: 'Malicious file upload',
        text: 'Attaching bad script.',
      }
    };
    
    let responseStatus3 = null;
    const res3 = {
      status: function(code) {
        responseStatus3 = code;
        return this;
      },
      json: function(payload) { return this; }
    };

    await handleInboundEmail(req3, res3);
    assert.strictEqual(responseStatus3, 403, 'Expected 403 Forbidden for unauthorized sender');
    console.log('✓ Test Case 3 passed.');

    // Restore original upload function
    DocketFileStorageService.uploadFile = originalUploadFile;

  } catch (err) {
    console.error('Integration test assertion failed:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    await mongoServer.stop();
  }

  console.log('\nAll Client Inbound/Outbound Email Integration tests passed.');
}

runTests().catch((err) => {
  console.error('Tests failed with error:', err);
  process.exit(1);
});
