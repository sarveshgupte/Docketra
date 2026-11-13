'use strict';

const assert = require('assert');
const mongoose = require('mongoose');

const { mcaFilingAutomationService } = require('../src/services/mcaFilingAutomation.service');
const CorporateFilingDraft = require('../src/models/CorporateFilingDraft.model');

const MOCK_CORPORATE_RECORD = {
  _id: new mongoose.Types.ObjectId(),
  firmId: new mongoose.Types.ObjectId(),
  cinOrLlpin: 'U74140RJ2013FTC042564',
  companyName: '1-0 ADVISORS INDIA PRIVATE LIMITED',
  companyClass: 'FOREIGN',
  companyCategory: 'Company limited by Shares',
  roc: 'RoC-Jaipur',
  authorizedCapital: 5000000,
  paidUpCapital: 2500000,
  registeredOfficeAddress: 'Plot No. 12, Jyoti Nagar, Lalkothi, Jaipur, Rajasthan 302005',
  registeredEmail: 'compliance@advisorsindia.test',
  directors: [
    { din: '01234567', fullName: 'Rajesh Sharma', designation: 'MANAGING_DIRECTOR' },
    { din: '07654321', fullName: 'Vikram Mehta', designation: 'DIRECTOR' },
  ],
};

const VALID_BALANCE_SHEET = {
  shareholdersFunds: {
    shareCapital: 2500000,
    reservesAndSurplus: 1500000,
  },
  nonCurrentLiabilities: {
    longTermBorrowings: 2000000,
  },
  currentLiabilities: {
    tradePayables: 1000000,
    shortTermProvisions: 500000,
  },
  // Total Equity & Liabilities = 25L + 15L + 20L + 10L + 5L = 75,00,000
  nonCurrentAssets: {
    propertyPlantEquipment: 4000000,
    intangibleAssets: 500000,
  },
  currentAssets: {
    inventories: 1000000,
    tradeReceivables: 1500000,
    cashAndBankBalances: 500000,
  },
  // Total Assets = 40L + 5L + 10L + 15L + 5L = 75,00,000 (TALLIED!)
};

const VALID_PROFIT_AND_LOSS = {
  revenueFromOperations: 12000000,
  otherIncome: 500000,
  expenses: {
    employeeBenefits: 6000000,
    financeCosts: 200000,
    depreciation: 500000,
    otherExpenses: 3000000,
  },
  taxExpense: {
    currentTax: 700000,
    deferredTax: 100000,
  },
};

const VALID_ATTACHMENTS = [
  { attachmentType: 'BALANCE_SHEET', title: 'Audited Financial Statements', isAttached: true, fileId: 'f1' },
  { attachmentType: 'AUDIT_REPORT', title: 'Independent Auditor Report', isAttached: true, fileId: 'f2' },
  { attachmentType: 'BOARD_REPORT', title: 'Board Report', isAttached: true, fileId: 'f3' },
  { attachmentType: 'NOTICE_OF_AGM', title: 'AGM Notice', isAttached: true, fileId: 'f4' },
];

async function testBuildAoc4Payload() {
  const payload = mcaFilingAutomationService.buildAoc4Payload({
    corporateRecord: MOCK_CORPORATE_RECORD,
    financialYear: '2025-2026',
    balanceSheet: VALID_BALANCE_SHEET,
    profitAndLoss: VALID_PROFIT_AND_LOSS,
    auditorDetails: {
      firmName: 'KPMG & Co.',
      frn: '123456N',
      caroApplicable: true,
    },
  });

  assert.strictEqual(payload.form_type, 'AOC_4');
  assert.strictEqual(payload.company_particulars.cin, 'U74140RJ2013FTC042564');
  assert.strictEqual(payload.balance_sheet.equity_and_liabilities.total_equity_and_liabilities, 7500000);
  assert.strictEqual(payload.balance_sheet.assets.total_assets, 7500000);
  assert.strictEqual(payload.profit_and_loss.total_revenue, 12500000);
  assert.strictEqual(payload.profit_and_loss.profit_before_tax, 2800000);
  assert.strictEqual(payload.profit_and_loss.profit_after_tax, 2000000);

  console.log('✓ testBuildAoc4Payload passed');
}

async function testBuildMgt7Payload() {
  const payload = mcaFilingAutomationService.buildMgt7Payload({
    corporateRecord: MOCK_CORPORATE_RECORD,
    financialYear: '2025-2026',
    isSmallCompanyOrOpc: false,
    shareholdingPattern: {
      promotersShares: 250000,
      promotersPercentage: 100,
    },
  });

  assert.strictEqual(payload.form_type, 'MGT_7');
  assert.strictEqual(payload.company_particulars.cin, 'U74140RJ2013FTC042564');
  assert.strictEqual(payload.capital_structure.paid_up_capital.equity_shares, 2500000);
  assert.strictEqual(payload.meetings.board_meetings.length, 4);
  assert.strictEqual(payload.directors_and_kmp.length, 2);

  console.log('✓ testBuildMgt7Payload passed');
}

async function testFilingValidationRules() {
  // 1. Untallied Balance sheet should fail validation
  const untalliedBs = JSON.parse(JSON.stringify(VALID_BALANCE_SHEET));
  untalliedBs.currentAssets.cashAndBankBalances = 9999999; // Discrepancy!

  const badPayload = mcaFilingAutomationService.buildAoc4Payload({
    corporateRecord: MOCK_CORPORATE_RECORD,
    financialYear: '2025-2026',
    balanceSheet: untalliedBs,
    profitAndLoss: VALID_PROFIT_AND_LOSS,
  });

  const untalliedResult = mcaFilingAutomationService.validateFilingPayload({
    formType: 'AOC_4',
    filingData: badPayload,
    corporateRecord: MOCK_CORPORATE_RECORD,
    attachments: VALID_ATTACHMENTS,
  });

  assert.strictEqual(untalliedResult.isValid, false);
  const tallyErr = untalliedResult.errors.find(e => e.code === 'BALANCE_SHEET_TALLY_MISMATCH');
  assert.ok(tallyErr, 'Must flag BALANCE_SHEET_TALLY_MISMATCH');

  // 2. Missing attachments should fail validation
  const goodPayload = mcaFilingAutomationService.buildAoc4Payload({
    corporateRecord: MOCK_CORPORATE_RECORD,
    financialYear: '2025-2026',
    balanceSheet: VALID_BALANCE_SHEET,
    profitAndLoss: VALID_PROFIT_AND_LOSS,
  });

  const missingAttachmentsResult = mcaFilingAutomationService.validateFilingPayload({
    formType: 'AOC_4',
    filingData: goodPayload,
    corporateRecord: MOCK_CORPORATE_RECORD,
    attachments: [], // Empty attachments!
  });

  assert.strictEqual(missingAttachmentsResult.isValid, false);
  const attachErrors = missingAttachmentsResult.errors.filter(e => e.code === 'MISSING_MANDATORY_ATTACHMENT');
  assert.ok(attachErrors.length >= 4, 'Must flag all 4 missing mandatory attachments');

  // 3. Fully valid submission
  const validResult = mcaFilingAutomationService.validateFilingPayload({
    formType: 'AOC_4',
    filingData: goodPayload,
    corporateRecord: MOCK_CORPORATE_RECORD,
    attachments: VALID_ATTACHMENTS,
  });

  assert.strictEqual(validResult.isValid, true, 'Fully valid payload must pass');
  assert.strictEqual(validResult.errors.length, 0);

  console.log('✓ testFilingValidationRules passed');
}

async function testSaveAndExportPackage() {
  const mockFirmId = new mongoose.Types.ObjectId();
  const cin = 'U74140RJ2013FTC042564';

  const goodPayload = mcaFilingAutomationService.buildAoc4Payload({
    corporateRecord: MOCK_CORPORATE_RECORD,
    financialYear: '2025-2026',
    balanceSheet: VALID_BALANCE_SHEET,
    profitAndLoss: VALID_PROFIT_AND_LOSS,
  });

  // 1. Save valid draft
  const draft = await mcaFilingAutomationService.saveFilingDraft({
    firmId: mockFirmId,
    cinOrLlpin: cin,
    formType: 'AOC_4',
    financialYear: '2025-2026',
    filingData: goodPayload,
    attachments: VALID_ATTACHMENTS,
    actorXID: 'X000001',
  });

  assert.strictEqual(draft.status, 'VALIDATED');
  assert.strictEqual(draft.validationResults.isValid, true);

  // 2. Export direct-upload package
  const pkg = mcaFilingAutomationService.exportMcaUploadPackage({ draft });
  assert.strictEqual(pkg.system, 'Docketra-MCA-Engine');
  assert.strictEqual(pkg.formType, 'AOC_4');
  assert.strictEqual(pkg.cin, cin);
  assert.strictEqual(pkg.digitalSignatureStatus, 'READY_FOR_DSC_SIGNING');
  assert.strictEqual(pkg.attachmentsManifest.length, 4);

  // 3. Export on invalid draft throws error
  const invalidDraft = new CorporateFilingDraft({
    firmId: mockFirmId,
    cinOrLlpin: cin,
    formType: 'AOC_4',
    financialYear: '2025-2026',
    status: 'VALIDATION_FAILED',
    validationResults: { isValid: false, errors: [{ code: 'ERR', message: 'Test error', field: 'test' }] },
    createdByXID: 'X000001',
  });

  assert.throws(
    () => mcaFilingAutomationService.exportMcaUploadPackage({ draft: invalidDraft }),
    /CANNOT_EXPORT_INVALID_FILING_DRAFT/
  );

  console.log('✓ testSaveAndExportPackage passed');
}

(async () => {
  try {
    await testBuildAoc4Payload();
    await testBuildMgt7Payload();
    await testFilingValidationRules();
    await testSaveAndExportPackage();

    console.log('\n=============================================');
    console.log('ALL Phase 3 MCA Filing Automation Tests PASSED!');
    console.log('=============================================\n');
  } catch (err) {
    console.error('Test failure:', err);
    process.exit(1);
  }
})();
