const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Case = require('../src/models/Case.model');
const Client = require('../src/models/Client.model');
const UploadSession = require('../src/models/UploadSession.model');
const Comment = require('../src/models/Comment.model');
const { createUploadSession } = require('../src/services/uploadSession.service');
const { processExpiredPendedDockets } = require('../src/services/docketWorkflow.service');
const { DocketStatus } = require('../src/domain/case/caseStatus');
const { DocketLifecycle } = require('../src/domain/docketLifecycle');

async function runClientUploadPortalTests() {
  console.log('Starting Client Upload Portal & Scheduler Unit Tests...');
  const mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);

  try {
    const firmId = new mongoose.Types.ObjectId().toString();
    const caseInternalId = new mongoose.Types.ObjectId().toString();
    const clientId = 'CL-TEST-001';

    // Create Client
    await Client.create({
      firmId,
      clientId,
      businessName: 'Test Client Corp',
      businessEmail: 'client@testcorp.com',
      status: 'active',
      isSystemClient: true,
      isDefaultClient: true,
      createdBySystem: true,
      createdByXid: 'SUPERADMIN',
    });

    const categoryId = new mongoose.Types.ObjectId();
    const userObjectId = new mongoose.Types.ObjectId();

    // Create Docket in PENDING status
    const pendedCase = await Case.create({
      caseInternalId,
      caseNumber: 'CO202607240001',
      caseId: 'CO202607240001',
      firmId,
      clientId,
      categoryId,
      subcategoryId: 'SUB-TAX-01',
      createdByXID: 'USR-100',
      slaDueAt: new Date(Date.now() + 86400000),
      title: 'Tax Filing Request',
      workType: 'Income Tax',
      status: 'PENDING',
      pendingReason: 'waiting_client',
      state: 'IN_PROGRESS',
      lifecycle: DocketLifecycle.WAITING,
      assignedToXID: 'USR-100',
      assignedTo: userObjectId,
      reopenAt: new Date(Date.now() - 1000), // Expired 1 second ago
    });

    // Create UploadSession
    const session = await createUploadSession({
      docketId: pendedCase.caseId,
      firmId,
      requirePin: false,
      expiryHours: 24,
      clientMessage: 'Please provide PAN card copy',
      senderName: 'Jane Agent',
      senderEmail: 'jane@firm.com',
      reopenAt: pendedCase.reopenAt,
    });

    assert.ok(session.token, 'Upload token generated');

    // Test Scheduler Processing for Expired Pended Dockets (Day 10 Expiry)
    const result = await processExpiredPendedDockets();
    assert.strictEqual(result.processedCount, 1, '1 expired session processed');

    // Verify Docket Unpended
    const updatedDocket = await Case.findOne({ _id: pendedCase._id });
    assert.strictEqual(updatedDocket.lifecycle, DocketLifecycle.ACTIVE);
    assert.strictEqual(updatedDocket.state, 'IN_PROGRESS');

    // Verify System Comment Created
    const comments = await Comment.find({ caseId: pendedCase.caseId });
    assert.strictEqual(comments.length, 1);
    assert.ok(comments[0].text.includes('Automated reminder email sent to client'));
    console.log('✓ Scheduled reminder & automated system comment verified.');

    console.log('✓ All Client Upload Portal Unit Tests Passed successfully.');
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    await mongoServer.stop();
  }
}

runClientUploadPortalTests();
