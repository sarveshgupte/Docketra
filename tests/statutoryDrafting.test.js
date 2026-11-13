'use strict';

const assert = require('assert');
const mongoose = require('mongoose');

const { statutoryDraftingService } = require('../src/services/statutoryDrafting.service');
const StatutoryDraftDocument = require('../src/models/StatutoryDraftDocument.model');
const CorporateMasterRecord = require('../src/models/CorporateMasterRecord.model');

const MOCK_CORPORATE_RECORD = {
  _id: new mongoose.Types.ObjectId(),
  firmId: new mongoose.Types.ObjectId(),
  cinOrLlpin: 'U74140RJ2013FTC042564',
  companyName: '1-0 ADVISORS INDIA PRIVATE LIMITED',
  companyClass: 'FOREIGN',
  companyCategory: 'Company limited by Shares',
  roc: 'RoC-Jaipur',
  incorporationDate: new Date('2013-05-15'),
  authorizedCapital: 5000000,
  paidUpCapital: 2500000,
  registeredOfficeAddress: 'Plot No. 12, Jyoti Nagar, Lalkothi, Jaipur, Rajasthan 302005',
  registeredEmail: 'compliance@advisorsindia.test',
  directors: [
    {
      din: '01234567',
      fullName: 'Rajesh Sharma',
      designation: 'MANAGING_DIRECTOR',
      appointmentDate: new Date('2013-05-15'),
      dir3KycStatus: 'FILED',
      dscToken: { tokenId: 'DSC-01', holderName: 'Rajesh Sharma' },
    },
    {
      din: '07654321',
      fullName: 'Vikram Mehta',
      designation: 'DIRECTOR',
      appointmentDate: new Date('2018-08-01'),
      dir3KycStatus: 'PENDING',
      dscToken: { tokenId: 'DSC-02', holderName: 'Vikram Mehta' },
    },
  ],
  charges: [
    {
      chargeId: 'CHG10049281',
      holderName: 'HDFC BANK LIMITED',
      amount: 15000000,
      creationDate: new Date('2020-02-10'),
      status: 'OPEN',
    },
  ],
};

async function testGenerateBoardReport() {
  const markdown = statutoryDraftingService.generateBoardReport({
    corporateRecord: MOCK_CORPORATE_RECORD,
    financialYear: '2025-2026',
    financialHighlights: {
      currentYear: {
        revenueFromOperations: 45000000,
        otherIncome: 1200000,
        totalExpenses: 38000000,
        profitBeforeTax: 8200000,
        taxExpense: 2100000,
        profitAfterTax: 6100000,
        transferToReserves: 500000,
        dividendRecommended: '₹2.00 (20%)',
      },
      previousYear: {
        revenueFromOperations: 38000000,
        otherIncome: 800000,
        totalExpenses: 33000000,
        profitBeforeTax: 5800000,
        taxExpense: 1500000,
        profitAfterTax: 4300000,
        transferToReserves: 0,
      },
    },
    boardMeetings: [
      { date: new Date('2025-06-15'), totalDirectors: 2, attendeesCount: 2 },
      { date: new Date('2025-09-10'), totalDirectors: 2, attendeesCount: 2 },
      { date: new Date('2025-12-18'), totalDirectors: 2, attendeesCount: 2 },
      { date: new Date('2026-03-24'), totalDirectors: 2, attendeesCount: 2 },
    ],
    auditors: {
      firmName: 'KPMG & Co. LLP',
      frn: '101234W',
      hasQualifications: false,
    },
  });

  assert.ok(markdown.includes("# BOARD'S REPORT"));
  assert.ok(markdown.includes('1-0 ADVISORS INDIA PRIVATE LIMITED'));
  assert.ok(markdown.includes('U74140RJ2013FTC042564'));
  assert.ok(markdown.includes('RoC-Jaipur'));
  assert.ok(markdown.includes('FINANCIAL SUMMARY AND HIGHLIGHTS'));
  assert.ok(markdown.includes('₹4,50,00,000.00'));
  assert.ok(markdown.includes('DIRECTORS\' RESPONSIBILITY STATEMENT'));
  assert.ok(markdown.includes('Rajesh Sharma'));
  assert.ok(markdown.includes('01234567'));
  assert.ok(markdown.includes('KPMG & Co. LLP'));

  console.log('✓ testGenerateBoardReport passed');
}

async function testGenerateAoc1() {
  const aoc1 = statutoryDraftingService.generateAoc1({
    corporateRecord: MOCK_CORPORATE_RECORD,
    financialYear: '2025-2026',
    subsidiaries: [
      {
        name: 'Advisors Tech Solutions Private Limited',
        shareCapital: 1000000,
        reserves: 5000000,
        totalAssets: 12000000,
        totalLiabilities: 6000000,
        turnover: 20000000,
        pbt: 4000000,
        tax: 1000000,
        pat: 3000000,
        percentageHolding: 99.9,
      },
    ],
    associates: [],
  });

  assert.ok(aoc1.includes('# FORM AOC-1'));
  assert.ok(aoc1.includes('Advisors Tech Solutions Private Limited'));
  assert.ok(aoc1.includes('PART "A": SUBSIDIARIES'));
  assert.ok(aoc1.includes('PART "B": ASSOCIATES AND JOINT VENTURES'));
  assert.ok(aoc1.includes('The Company does not have any Associate Company'));

  console.log('✓ testGenerateAoc1 passed');
}

async function testGenerateAoc2() {
  const aoc2 = statutoryDraftingService.generateAoc2({
    corporateRecord: MOCK_CORPORATE_RECORD,
    financialYear: '2025-2026',
    contractsArmLength: [
      {
        partyName: 'Rajesh Sharma Consulting LLP',
        relationship: 'Director is partner',
        contractNature: 'Advisory and Consultancy Services',
        duration: '1 Year',
        amount: 2400000,
        approvalDate: new Date('2025-04-10'),
      },
    ],
    contractsNotArmLength: [],
  });

  assert.ok(aoc2.includes('# FORM AOC-2'));
  assert.ok(aoc2.includes('Rajesh Sharma Consulting LLP'));
  assert.ok(aoc2.includes('Advisory and Consultancy Services'));
  assert.ok(aoc2.includes('₹24,00,000.00'));

  console.log('✓ testGenerateAoc2 passed');
}

async function testGenerateMgt9() {
  const mgt9 = statutoryDraftingService.generateMgt9({
    corporateRecord: MOCK_CORPORATE_RECORD,
    financialYear: '2025-2026',
    principalActivities: [
      { name: 'Corporate Advisory and Management Consultancy', nicCode: '70200', turnoverPercentage: 100 },
    ],
    shareholdingPattern: {
      promotersCount: '25,000',
      totalShares: '25,000',
    },
    indebtedness: {
      securedStart: 18000000,
      securedEnd: 15000000,
      netChange: -3000000,
    },
  });

  assert.ok(mgt9.includes('# FORM MGT-9'));
  assert.ok(mgt9.includes('EXTRACT OF ANNUAL RETURN'));
  assert.ok(mgt9.includes('Corporate Advisory and Management Consultancy'));
  assert.ok(mgt9.includes('₹1,50,00,000.00'));

  console.log('✓ testGenerateMgt9 passed');
}

async function testStatutoryDraftDocumentModelAndService() {
  const mockFirmId = new mongoose.Types.ObjectId();
  const cin = 'U74140RJ2013FTC042564';

  // In-memory store for model testing
  const store = new Map();

  const originalFindOne = StatutoryDraftDocument.findOne;
  StatutoryDraftDocument.findOne = function(query) {
    const key = query._id ? String(query._id) : `${query.firmId}_${query.cinOrLlpin}_${query.documentType}_${query.financialYear}`;
    const doc = store.get(key) || null;
    return {
      sort: () => Promise.resolve(doc),
      then: (resolve) => resolve(doc),
    };
  };

  const originalSave = StatutoryDraftDocument.prototype.save;
  StatutoryDraftDocument.prototype.save = function() {
    this._id = this._id || new mongoose.Types.ObjectId();
    const key = `${this.firmId}_${this.cinOrLlpin}_${this.documentType}_${this.financialYear}`;
    store.set(key, this);
    store.set(String(this._id), this);
    return Promise.resolve(this);
  };

  try {
    // 1. Schema validation
    const validDraft = new StatutoryDraftDocument({
      firmId: mockFirmId,
      cinOrLlpin: cin,
      financialYear: '2025-2026',
      documentType: 'BOARD_REPORT',
      title: "Board's Report - FY 2025-2026",
      content: '# Test Board Report',
      createdByXID: 'X000001',
    });
    const err = validDraft.validateSync();
    assert.strictEqual(err, undefined, 'Valid StatutoryDraftDocument must pass validation');

    // 2. Service save draft document
    const saved = await statutoryDraftingService.saveDraftDocument({
      firmId: mockFirmId,
      cinOrLlpin: cin,
      financialYear: '2025-2026',
      documentType: 'BOARD_REPORT',
      title: "Board's Report - FY 2025-2026",
      content: '# Full Board Report Markdown',
      actorXID: 'X000001',
    });

    assert.ok(saved);
    assert.strictEqual(saved.version, 1);
    assert.strictEqual(saved.status, 'DRAFT');

    // 3. Request client sign-off
    const signOff = await statutoryDraftingService.requestClientSignOff({
      draftId: saved._id,
      firmId: mockFirmId,
      approverEmail: 'rajesh@advisorsindia.test',
      approvalType: 'client',
      actorXID: 'X000001',
    });

    assert.strictEqual(signOff.status, 'AWAITING_CLIENT_SIGN_OFF');
    assert.strictEqual(signOff.approvalRef.decision, 'pending');
    assert.strictEqual(signOff.approvalRef.approverEmail, 'rajesh@advisorsindia.test');

    console.log('✓ testStatutoryDraftDocumentModelAndService passed');
  } finally {
    StatutoryDraftDocument.findOne = originalFindOne;
    StatutoryDraftDocument.prototype.save = originalSave;
  }
}

(async () => {
  try {
    await testGenerateBoardReport();
    await testGenerateAoc1();
    await testGenerateAoc2();
    await testGenerateMgt9();
    await testStatutoryDraftDocumentModelAndService();

    console.log('\n===========================================');
    console.log('ALL Phase 2 Statutory Drafting Tests PASSED!');
    console.log('===========================================\n');
  } catch (err) {
    console.error('Test failure:', err);
    process.exit(1);
  }
})();
