'use strict';

const assert = require('assert');
const mongoose = require('mongoose');

const {
  isValidCinOrLlpin,
  parseCinStructure,
  computeStatutoryDueDates,
  fetchCompanyMasterData,
} = require('../src/services/mcaDataFetcher.service');

const CorporateMasterRecord = require('../src/models/CorporateMasterRecord.model');
const { processClientMcaSyncJob } = require('../src/jobs/mcaSync.job');
const { corporateComplianceService } = require('../src/services/corporateCompliance.service');
const { enqueueClientMcaSyncJob, enqueueNightlyMcaSweepJob } = require('../src/queues/mcaSync.queue');
const { runScheduledMcaSweep } = require('../src/workers/mcaSync.worker');

async function testCinValidationAndParsing() {
  // Valid CINs
  assert.strictEqual(isValidCinOrLlpin('U74140RJ2013FTC042564'), true);
  assert.strictEqual(isValidCinOrLlpin('L17110MH1973PLC019786'), true);
  assert.strictEqual(isValidCinOrLlpin('U72900DL2020PTC368921'), true);

  // Valid LLPINs
  assert.strictEqual(isValidCinOrLlpin('AAD-6272'), true);
  assert.strictEqual(isValidCinOrLlpin('AAN-1225'), true);

  // Invalid formats
  assert.strictEqual(isValidCinOrLlpin('INVALID_CIN'), false);
  assert.strictEqual(isValidCinOrLlpin('12345'), false);
  assert.strictEqual(isValidCinOrLlpin(''), false);
  assert.strictEqual(isValidCinOrLlpin(null), false);

  // CIN Structure Parsing
  const parsed = parseCinStructure('U74140RJ2013FTC042564');
  assert.strictEqual(parsed.isListed, false);
  assert.strictEqual(parsed.stateCode, 'RJ');
  assert.strictEqual(parsed.roc, 'RoC-Jaipur');
  assert.strictEqual(parsed.incorporationYear, 2013);
  assert.strictEqual(parsed.companyClass, 'FOREIGN');

  const parsedListed = parseCinStructure('L17110MH1973PLC019786');
  assert.strictEqual(parsedListed.isListed, true);
  assert.strictEqual(parsedListed.roc, 'RoC-Mumbai');
  assert.strictEqual(parsedListed.companyClass, 'PUBLIC');

  console.log('✓ testCinValidationAndParsing passed');
}

async function testStatutoryDateCalculations() {
  const currentYear = new Date().getFullYear();
  const dates = computeStatutoryDueDates({ referenceYear: currentYear });

  // AGM is 30 September
  assert.strictEqual(dates.agmDueDate.getUTCMonth(), 8); // September (0-indexed)
  assert.strictEqual(dates.agmDueDate.getUTCDate(), 30);

  // AOC-4 is 30 October (30 days from AGM)
  assert.strictEqual(dates.aoc4DueDate.getUTCMonth(), 9); // October
  assert.strictEqual(dates.aoc4DueDate.getUTCDate(), 30);

  // MGT-7 is 29 November (60 days from AGM)
  assert.strictEqual(dates.mgt7DueDate.getUTCMonth(), 10); // November
  assert.strictEqual(dates.mgt7DueDate.getUTCDate(), 29);

  // DIR-3 KYC is 30 September
  assert.strictEqual(dates.dir3KycDueDate.getUTCMonth(), 8);
  assert.strictEqual(dates.dir3KycDueDate.getUTCDate(), 30);

  console.log('✓ testStatutoryDateCalculations passed');
}

async function testFetchCompanyMasterData() {
  const data = await fetchCompanyMasterData('U74140RJ2013FTC042564');
  assert.strictEqual(data.cinOrLlpin, 'U74140RJ2013FTC042564');
  assert.strictEqual(data.companyName, '1-0 ADVISORS INDIA PRIVATE LIMITED');
  assert.strictEqual(data.status, 'ACTIVE');
  assert.strictEqual(data.roc, 'RoC-Jaipur');
  assert.strictEqual(data.directors.length, 2);
  assert.strictEqual(data.charges.length, 1);
  assert.strictEqual(data.filings.length, 2);

  // Check director details
  const dir = data.directors[0];
  assert.strictEqual(dir.din, '01234567');
  assert.strictEqual(dir.fullName, 'Rajesh Sharma');
  assert.strictEqual(dir.dscToken.tokenId, 'DSC-RAJ-01');

  console.log('✓ testFetchCompanyMasterData passed');
}

async function testCorporateMasterRecordSchemaValidation() {
  const validDoc = new CorporateMasterRecord({
    firmId: new mongoose.Types.ObjectId(),
    cinOrLlpin: 'U74140RJ2013FTC042564',
    companyName: '1-0 Advisors India Private Limited',
    companyClass: 'FOREIGN',
    status: 'ACTIVE',
  });

  const err = validDoc.validateSync();
  assert.strictEqual(err, undefined, 'Valid corporate doc should pass schema validation');

  const invalidDoc = new CorporateMasterRecord({
    // Missing required firmId and cinOrLlpin
    companyName: 'Missing required fields',
  });
  const invalidErr = invalidDoc.validateSync();
  assert.ok(invalidErr, 'Missing required fields should fail validation');
  assert.ok(invalidErr.errors.firmId);
  assert.ok(invalidErr.errors.cinOrLlpin);

  console.log('✓ testCorporateMasterRecordSchemaValidation passed');
}

async function testJobAndServiceLogicWithStubbedModel() {
  const mockFirmId = new mongoose.Types.ObjectId();
  const cin = 'U74140RJ2013FTC042564';
  const mockClientId = 'C888001';

  // In-memory store for stubbing
  const store = new Map();

  const originalFindOne = CorporateMasterRecord.findOne;
  const originalFind = CorporateMasterRecord.find;
  const originalCount = CorporateMasterRecord.countDocuments;

  CorporateMasterRecord.findOne = function(query) {
    const key = `${query.firmId}_${query.cinOrLlpin || query.clientId}`;
    const doc = store.get(key) || null;
    return Promise.resolve(doc);
  };

  CorporateMasterRecord.find = function(query) {
    const items = Array.from(store.values()).filter(d => String(d.firmId) === String(query.firmId));
    return {
      sort: () => ({
        skip: () => ({
          limit: () => ({
            lean: () => Promise.resolve(items),
          }),
        }),
      }),
      select: () => ({
        limit: () => ({
          lean: () => Promise.resolve(items),
        }),
      }),
      lean: () => Promise.resolve(items),
    };
  };

  CorporateMasterRecord.countDocuments = function() {
    return Promise.resolve(store.size);
  };

  // Mock save function on prototype
  const originalSave = CorporateMasterRecord.prototype.save;
  CorporateMasterRecord.prototype.save = function() {
    const key = `${this.firmId}_${this.cinOrLlpin}`;
    store.set(key, this);
    return Promise.resolve(this);
  };

  try {
    // 1. Run sync job
    const jobResult = await processClientMcaSyncJob({
      firmId: mockFirmId,
      clientId: mockClientId,
      cinOrLlpin: cin,
      actorXID: 'X999001',
    });

    assert.strictEqual(jobResult.success, true);
    assert.strictEqual(jobResult.record.companyName, '1-0 ADVISORS INDIA PRIVATE LIMITED');
    assert.strictEqual(jobResult.record.directors.length, 2);
    assert.strictEqual(jobResult.record.charges.length, 1);

    // 2. Test corporateComplianceService.getRecord
    const retrieved = await corporateComplianceService.getRecord({
      firmId: mockFirmId,
      cinOrLlpin: cin,
    });
    assert.ok(retrieved);
    assert.strictEqual(retrieved.companyName, '1-0 ADVISORS INDIA PRIVATE LIMITED');

    // 3. Test corporateComplianceService.listRecords
    const list = await corporateComplianceService.listRecords({ firmId: mockFirmId });
    assert.strictEqual(list.total, 1);
    assert.strictEqual(list.records.length, 1);

    // 4. Test compliance alerts
    const alerts = await corporateComplianceService.getComplianceAlerts({
      firmId: mockFirmId,
      dscThresholdDays: 60,
    });
    assert.ok(alerts.pendingDir3Kyc.length >= 1, 'Should flag director with pending DIR-3 KYC');
    assert.ok(alerts.expiringDscs.length >= 1, 'Should flag expiring DSC token');

    // 5. Test queue fallback when Redis is absent
    const enqueueResult = await enqueueClientMcaSyncJob({
      firmId: mockFirmId,
      clientId: mockClientId,
      cinOrLlpin: cin,
    });
    assert.strictEqual(enqueueResult.queued, false);
    assert.strictEqual(enqueueResult.error.message, 'REDIS_UNAVAILABLE');

    const enqueueSweepResult = await enqueueNightlyMcaSweepJob({});
    assert.strictEqual(enqueueSweepResult.queued, false);

    // 6. Test scheduled sweep
    await runScheduledMcaSweep();

    console.log('✓ testJobAndServiceLogicWithStubbedModel passed');
  } finally {
    CorporateMasterRecord.findOne = originalFindOne;
    CorporateMasterRecord.find = originalFind;
    CorporateMasterRecord.countDocuments = originalCount;
    CorporateMasterRecord.prototype.save = originalSave;
  }
}

(async () => {
  try {
    await testCinValidationAndParsing();
    await testStatutoryDateCalculations();
    await testFetchCompanyMasterData();
    await testCorporateMasterRecordSchemaValidation();
    await testJobAndServiceLogicWithStubbedModel();

    console.log('\n======================================');
    console.log('ALL Phase 1 MCA Sync Worker Tests PASSED!');
    console.log('======================================\n');
  } catch (err) {
    console.error('Test failure:', err);
    process.exit(1);
  }
})();
