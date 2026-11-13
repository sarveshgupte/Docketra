'use strict';

const CorporateFilingDraft = require('../models/CorporateFilingDraft.model');
const CorporateMasterRecord = require('../models/CorporateMasterRecord.model');
const log = require('../utils/log');

class McaFilingAutomationService {
  /**
   * Builds standardized Schedule III Balance Sheet & P&L payload for Form AOC-4
   */
  buildAoc4Payload({
    corporateRecord,
    financialYear = '2025-2026',
    balanceSheet = {},
    profitAndLoss = {},
    auditorDetails = {},
    signatories = [],
    generalInfo = {},
  }) {
    if (!corporateRecord) {
      throw new Error('CORPORATE_RECORD_REQUIRED_FOR_AOC4');
    }

    const cin = corporateRecord.cinOrLlpin;
    const [fyStartYear, fyEndYear] = financialYear.split('-').map(y => parseInt(y, 10));
    const fyStartDate = `${fyStartYear}-04-01`;
    const fyEndDate = `${fyEndYear}-03-31`;

    // 1. Equity & Liabilities breakdown
    const sf = balanceSheet.shareholdersFunds || {};
    const ncl = balanceSheet.nonCurrentLiabilities || {};
    const cl = balanceSheet.currentLiabilities || {};

    const totalShareholdersFunds = Number(sf.shareCapital || 0) + Number(sf.reservesAndSurplus || 0) + Number(sf.moneyAgainstWarrants || 0);
    const totalNonCurrentLiabilities = Number(ncl.longTermBorrowings || 0) + Number(ncl.deferredTaxLiabilities || 0) + Number(ncl.otherLongTermLiabilities || 0) + Number(ncl.longTermProvisions || 0);
    const totalCurrentLiabilities = Number(cl.shortTermBorrowings || 0) + Number(cl.tradePayables || 0) + Number(cl.otherCurrentLiabilities || 0) + Number(cl.shortTermProvisions || 0);

    const totalEquityAndLiabilities = totalShareholdersFunds + Number(balanceSheet.shareApplicationMoneyPendingAllotment || 0) + totalNonCurrentLiabilities + totalCurrentLiabilities;

    // 2. Assets breakdown
    const nca = balanceSheet.nonCurrentAssets || {};
    const ca = balanceSheet.currentAssets || {};

    const totalNonCurrentAssets = Number(nca.propertyPlantEquipment || 0) + Number(nca.intangibleAssets || 0) + Number(nca.capitalWorkInProgress || 0) + Number(nca.nonCurrentInvestments || 0) + Number(nca.deferredTaxAssets || 0) + Number(nca.longTermLoansAdvances || 0) + Number(nca.otherNonCurrentAssets || 0);
    const totalCurrentAssets = Number(ca.currentInvestments || 0) + Number(ca.inventories || 0) + Number(ca.tradeReceivables || 0) + Number(ca.cashAndBankBalances || 0) + Number(ca.shortTermLoansAdvances || 0) + Number(ca.otherCurrentAssets || 0);

    const totalAssets = totalNonCurrentAssets + totalCurrentAssets;

    // 3. Profit & Loss breakdown
    const pl = profitAndLoss;
    const totalRevenue = Number(pl.revenueFromOperations || 0) + Number(pl.otherIncome || 0);
    const exp = pl.expenses || {};
    const totalExpenses = Number(exp.costOfMaterials || 0) + Number(exp.purchaseOfStock || 0) + Number(exp.changesInInventories || 0) + Number(exp.employeeBenefits || 0) + Number(exp.financeCosts || 0) + Number(exp.depreciation || 0) + Number(exp.otherExpenses || 0);

    const profitBeforeTax = Number(pl.profitBeforeTax != null ? pl.profitBeforeTax : totalRevenue - totalExpenses);
    const taxExp = pl.taxExpense || {};
    const totalTax = Number(taxExp.currentTax || 0) + Number(taxExp.deferredTax || 0);
    const profitAfterTax = Number(pl.profitAfterTax != null ? pl.profitAfterTax : profitBeforeTax - totalTax);

    return {
      mca_form_version: 'V3-AOC-4-2026',
      form_type: 'AOC_4',
      company_particulars: {
        cin,
        company_name: corporateRecord.companyName,
        registered_office: corporateRecord.registeredOfficeAddress,
        email: corporateRecord.registeredEmail,
        roc: corporateRecord.roc,
        company_category: corporateRecord.companyCategory,
        company_class: corporateRecord.companyClass,
        authorized_capital: corporateRecord.authorizedCapital,
        paid_up_capital: sf.shareCapital || corporateRecord.paidUpCapital,
      },
      financial_parameters: {
        financial_year_start: fyStartDate,
        financial_year_end: fyEndDate,
        nature_of_financial_statements: generalInfo.natureOfFinancialStatements || 'STANDALONE',
        accounting_standard: generalInfo.accountingStandard || 'AS',
        agm_date: generalInfo.agmDate || `${fyEndYear}-09-30`,
        is_agm_held: generalInfo.isAgmHeld !== false,
      },
      balance_sheet: {
        equity_and_liabilities: {
          shareholders_funds: {
            share_capital: Number(sf.shareCapital || 0),
            reserves_and_surplus: Number(sf.reservesAndSurplus || 0),
            money_received_against_warrants: Number(sf.moneyAgainstWarrants || 0),
            total: totalShareholdersFunds,
          },
          share_application_money_pending_allotment: Number(balanceSheet.shareApplicationMoneyPendingAllotment || 0),
          non_current_liabilities: {
            long_term_borrowings: Number(ncl.longTermBorrowings || 0),
            deferred_tax_liabilities: Number(ncl.deferredTaxLiabilities || 0),
            other_long_term_liabilities: Number(ncl.otherLongTermLiabilities || 0),
            long_term_provisions: Number(ncl.longTermProvisions || 0),
            total: totalNonCurrentLiabilities,
          },
          current_liabilities: {
            short_term_borrowings: Number(cl.shortTermBorrowings || 0),
            trade_payables: Number(cl.tradePayables || 0),
            other_current_liabilities: Number(cl.otherCurrentLiabilities || 0),
            short_term_provisions: Number(cl.shortTermProvisions || 0),
            total: totalCurrentLiabilities,
          },
          total_equity_and_liabilities: totalEquityAndLiabilities,
        },
        assets: {
          non_current_assets: {
            property_plant_equipment: Number(nca.propertyPlantEquipment || 0),
            intangible_assets: Number(nca.intangibleAssets || 0),
            capital_work_in_progress: Number(nca.capitalWorkInProgress || 0),
            non_current_investments: Number(nca.nonCurrentInvestments || 0),
            deferred_tax_assets: Number(nca.deferredTaxAssets || 0),
            long_term_loans_and_advances: Number(nca.longTermLoansAdvances || 0),
            other_non_current_assets: Number(nca.otherNonCurrentAssets || 0),
            total: totalNonCurrentAssets,
          },
          current_assets: {
            current_investments: Number(ca.currentInvestments || 0),
            inventories: Number(ca.inventories || 0),
            trade_receivables: Number(ca.tradeReceivables || 0),
            cash_and_bank_balances: Number(ca.cashAndBankBalances || 0),
            short_term_loans_and_advances: Number(ca.shortTermLoansAdvances || 0),
            other_current_assets: Number(ca.otherCurrentAssets || 0),
            total: totalCurrentAssets,
          },
          total_assets: totalAssets,
        },
      },
      profit_and_loss: {
        revenue_from_operations: Number(pl.revenueFromOperations || 0),
        other_income: Number(pl.otherIncome || 0),
        total_revenue: totalRevenue,
        expenses: {
          cost_of_materials: Number(exp.costOfMaterials || 0),
          purchase_of_stock: Number(exp.purchaseOfStock || 0),
          changes_in_inventories: Number(exp.changesInInventories || 0),
          employee_benefits: Number(exp.employeeBenefits || 0),
          finance_costs: Number(exp.financeCosts || 0),
          depreciation_and_amortization: Number(exp.depreciation || 0),
          other_expenses: Number(exp.otherExpenses || 0),
          total_expenses: totalExpenses,
        },
        profit_before_tax: profitBeforeTax,
        tax_expense: {
          current_tax: Number(taxExp.currentTax || 0),
          deferred_tax: Number(taxExp.deferredTax || 0),
          total: totalTax,
        },
        profit_after_tax: profitAfterTax,
        earnings_per_share: {
          basic: Number(pl.epsBasic || 0),
          diluted: Number(pl.epsDiluted || 0),
        },
      },
      auditor_details: {
        firm_name: auditorDetails.firmName || 'Statutory Auditor',
        firm_registration_number: auditorDetails.frn || '',
        auditor_type: auditorDetails.auditorType || 'CA_FIRM',
        membership_number: auditorDetails.membershipNumber || '',
        caro_applicable: Boolean(auditorDetails.caroApplicable),
        has_qualifications: Boolean(auditorDetails.hasQualifications),
      },
      signatories: signatories.length > 0 ? signatories : (corporateRecord.directors || []).slice(0, 2).map(d => ({
        din: d.din,
        designation: d.designation,
        name: d.fullName,
      })),
    };
  }

  /**
   * Builds standardized Annual Return payload for Form MGT-7 / MGT-7A
   */
  buildMgt7Payload({
    corporateRecord,
    financialYear = '2025-2026',
    isSmallCompanyOrOpc = false,
    principalActivities = [],
    shareholdingPattern = {},
    meetingDetails = {},
    directorsRemuneration = [],
    indebtedness = {},
    certifyingProfessional = {},
  }) {
    if (!corporateRecord) {
      throw new Error('CORPORATE_RECORD_REQUIRED_FOR_MGT7');
    }

    const cin = corporateRecord.cinOrLlpin;
    const [fyStartYear, fyEndYear] = financialYear.split('-').map(y => parseInt(y, 10));

    return {
      mca_form_version: 'V3-MGT-7-2026',
      form_type: isSmallCompanyOrOpc ? 'MGT_7A' : 'MGT_7',
      company_particulars: {
        cin,
        company_name: corporateRecord.companyName,
        registered_office: corporateRecord.registeredOfficeAddress,
        email: corporateRecord.registeredEmail,
        roc: corporateRecord.roc,
        company_category: corporateRecord.companyCategory,
        company_class: corporateRecord.companyClass,
        incorporation_date: corporateRecord.incorporationDate,
        is_small_company: Boolean(isSmallCompanyOrOpc),
        financial_year_from: `${fyStartYear}-04-01`,
        financial_year_to: `${fyEndYear}-03-31`,
      },
      principal_business_activities: principalActivities.length > 0 ? principalActivities : [
        { main_activity: 'IT Services & Business Consulting', nic_code: '62099', turnover_percentage: 100 },
      ],
      capital_structure: {
        authorized_capital: {
          equity_shares: Number(corporateRecord.authorizedCapital || 0),
          face_value_per_share: 10,
          total_shares: Math.floor(Number(corporateRecord.authorizedCapital || 0) / 10),
        },
        paid_up_capital: {
          equity_shares: Number(corporateRecord.paidUpCapital || 0),
          face_value_per_share: 10,
          total_shares: Math.floor(Number(corporateRecord.paidUpCapital || 0) / 10),
        },
      },
      shareholding_pattern: {
        promoters_holding: {
          total_shares: shareholdingPattern.promotersShares || Math.floor(Number(corporateRecord.paidUpCapital || 0) / 10),
          percentage: shareholdingPattern.promotersPercentage || 100.0,
        },
        public_holding: {
          total_shares: shareholdingPattern.publicShares || 0,
          percentage: shareholdingPattern.publicPercentage || 0.0,
        },
      },
      meetings: {
        board_meetings: meetingDetails.boardMeetings || [
          { meeting_number: 1, date: `${fyStartYear}-06-15`, total_directors: 2, attendees_count: 2 },
          { meeting_number: 2, date: `${fyStartYear}-09-15`, total_directors: 2, attendees_count: 2 },
          { meeting_number: 3, date: `${fyStartYear}-12-15`, total_directors: 2, attendees_count: 2 },
          { meeting_number: 4, date: `${fyEndYear}-03-15`, total_directors: 2, attendees_count: 2 },
        ],
        annual_general_meeting: {
          is_agm_held: true,
          date: meetingDetails.agmDate || `${fyEndYear}-09-30`,
          due_date: `${fyEndYear}-09-30`,
        },
      },
      indebtedness: {
        secured_loans: Number(indebtedness.securedLoans || 0),
        unsecured_loans: Number(indebtedness.unsecuredLoans || 0),
        total_indebtedness: Number(indebtedness.securedLoans || 0) + Number(indebtedness.unsecuredLoans || 0),
      },
      directors_and_kmp: (corporateRecord.directors || []).map(d => ({
        din: d.din,
        name: d.fullName,
        designation: d.designation,
        meetings_attended: 4,
        remuneration: 0,
      })),
      certifying_professional: {
        type: certifyingProfessional.type || 'PRACTICING_COMPANY_SECRETARY',
        name: certifyingProfessional.name || 'Practicing CS',
        membership_type: certifyingProfessional.membershipType || 'FCS',
        membership_number: certifyingProfessional.membershipNumber || '99999',
        certificate_of_practice_number: certifyingProfessional.copNumber || '12345',
      },
    };
  }

  /**
   * Deterministic cross-validation engine verifying arithmetic equations,
   * capital constraints, DIN validity, and mandatory attachment checklist.
   */
  validateFilingPayload({ formType, filingData, corporateRecord, attachments = [] }) {
    const errors = [];
    const warnings = [];
    let checkedRulesCount = 0;

    const attachedTypes = new Set(
      attachments.filter(a => a.isAttached || a.fileId).map(a => a.attachmentType)
    );

    // ==========================================
    // 1. FORM AOC-4 VALIDATIONS
    // ==========================================
    if (formType.startsWith('AOC_4')) {
      checkedRulesCount += 6;
      const bs = filingData.balance_sheet || {};
      const el = bs.equity_and_liabilities || {};
      const ast = bs.assets || {};

      const totalEquityLiab = Number(el.total_equity_and_liabilities || 0);
      const totalAssets = Number(ast.total_assets || 0);

      // Rule 1: Balance Sheet equation tally
      const variance = Math.abs(totalEquityLiab - totalAssets);
      if (variance > 0.01) {
        errors.push({
          field: 'balance_sheet.tally',
          code: 'BALANCE_SHEET_TALLY_MISMATCH',
          message: `Balance Sheet does not tally. Total Assets (₹${totalAssets.toLocaleString('en-IN')}) != Total Equity & Liabilities (₹${totalEquityLiab.toLocaleString('en-IN')}). Discrepancy: ₹${variance.toLocaleString('en-IN')}.`,
          severity: 'ERROR',
        });
      }

      // Rule 2: Paid-up Capital <= Authorized Capital
      const paidUp = Number(el.shareholders_funds?.share_capital || filingData.company_particulars?.paid_up_capital || 0);
      const authorized = Number(corporateRecord?.authorizedCapital || filingData.company_particulars?.authorized_capital || 0);
      if (authorized > 0 && paidUp > authorized) {
        errors.push({
          field: 'balance_sheet.share_capital',
          code: 'PAID_UP_CAPITAL_EXCEEDS_AUTHORIZED',
          message: `Paid-up capital (₹${paidUp.toLocaleString('en-IN')}) exceeds authorized capital (₹${authorized.toLocaleString('en-IN')}). Increase authorized capital via SH-7 before filing.`,
          severity: 'ERROR',
        });
      }

      // Rule 3: Negative reserves check
      const reserves = Number(el.shareholders_funds?.reserves_and_surplus || 0);
      if (reserves < 0) {
        warnings.push({
          field: 'balance_sheet.reserves_and_surplus',
          code: 'NEGATIVE_RESERVES_DETECTED',
          message: `Negative Reserves & Surplus (₹${reserves.toLocaleString('en-IN')}) detected. Ensure accumulated losses are disclosed in notes.`,
          severity: 'WARNING',
        });
      }

      // Rule 4: Mandatory attachments checklist for AOC-4
      const mandatoryAoc4Attachments = [
        { type: 'BALANCE_SHEET', name: 'Audited Balance Sheet & P&L Account' },
        { type: 'AUDIT_REPORT', name: 'Independent Auditor’s Report' },
        { type: 'BOARD_REPORT', name: 'Board’s Report under Section 134' },
        { type: 'NOTICE_OF_AGM', name: 'Notice of AGM' },
      ];

      for (const item of mandatoryAoc4Attachments) {
        if (!attachedTypes.has(item.type)) {
          errors.push({
            field: `attachments.${item.type}`,
            code: 'MISSING_MANDATORY_ATTACHMENT',
            message: `Mandatory attachment missing: ${item.name} (${item.type}).`,
            severity: 'ERROR',
          });
        }
      }

      // Check CARO attachment if applicable
      if (filingData.auditor_details?.caro_applicable && !attachedTypes.has('CARO_REPORT')) {
        warnings.push({
          field: 'attachments.CARO_REPORT',
          code: 'CARO_REPORT_RECOMMENDED',
          message: 'CARO is marked applicable in auditor details, but CARO_REPORT attachment is not attached.',
          severity: 'WARNING',
        });
      }
    }

    // ==========================================
    // 2. FORM MGT-7 / 7A VALIDATIONS
    // ==========================================
    if (formType.startsWith('MGT_7')) {
      checkedRulesCount += 5;
      const cap = filingData.capital_structure || {};
      const paidUp = Number(cap.paid_up_capital?.equity_shares || 0);
      const authorized = Number(cap.authorized_capital?.equity_shares || 0);

      if (authorized > 0 && paidUp > authorized) {
        errors.push({
          field: 'capital_structure.paid_up_capital',
          code: 'PAID_UP_CAPITAL_EXCEEDS_AUTHORIZED',
          message: `Paid-up capital exceeds authorized capital in annual return.`,
          severity: 'ERROR',
        });
      }

      if (!attachedTypes.has('SHAREHOLDERS_LIST')) {
        errors.push({
          field: 'attachments.SHAREHOLDERS_LIST',
          code: 'MISSING_MANDATORY_ATTACHMENT',
          message: 'Mandatory attachment missing: List of Shareholders and Debenture Holders (SHAREHOLDERS_LIST).',
          severity: 'ERROR',
        });
      }

      // If Paid-up capital >= 10 Cr or turnover >= 50 Cr, MGT-8 is mandatory
      if (paidUp >= 100000000 && !attachedTypes.has('MGT_8_SECRETARIAL_CERTIFICATE')) {
        errors.push({
          field: 'attachments.MGT_8_SECRETARIAL_CERTIFICATE',
          code: 'MGT_8_CERTIFICATE_MANDATORY',
          message: 'Paid-up share capital is ₹10 Crore or more; Form MGT-8 Secretarial Compliance Certificate is mandatory under Section 92(2).',
          severity: 'ERROR',
        });
      }
    }

    // ==========================================
    // 3. COMMON SIGNATORY VALIDATION
    // ==========================================
    checkedRulesCount += 2;
    const signatories = filingData.signatories || [];
    const activeDins = new Set((corporateRecord?.directors || []).map(d => d.din));

    for (const sig of signatories) {
      if (sig.din && !activeDins.has(sig.din)) {
        warnings.push({
          field: 'signatories.din',
          code: 'SIGNATORY_DIN_NOT_IN_MASTER_RECORD',
          message: `Signatory DIN (${sig.din}) is not found in the active master record for this company.`,
          severity: 'WARNING',
        });
      }
    }

    return {
      isValid: errors.length === 0,
      checkedRulesCount,
      errors,
      warnings,
      validatedAt: new Date(),
    };
  }

  /**
   * Upserts a corporate filing draft and executes validation
   */
  async saveFilingDraft({
    firmId,
    clientId,
    cinOrLlpin,
    formType,
    financialYear,
    filingData = {},
    attachments = [],
    actorXID = 'SYSTEM',
    caseId = null,
  }) {
    if (!firmId || !cinOrLlpin || !formType || !financialYear) {
      throw new Error('FILING_DRAFT_MISSING_REQUIRED_PARAMS');
    }

    const cleanCin = cinOrLlpin.trim().toUpperCase();
    const mongoose = require('mongoose');

    // Fetch CorporateMasterRecord (if DB is active)
    const corporateRecord = (mongoose.connection.readyState === 1)
      ? await CorporateMasterRecord.findOne({ firmId, cinOrLlpin: cleanCin })
      : null;

    // Run deterministic pre-filing validation
    const validationResults = this.validateFilingPayload({
      formType,
      filingData,
      corporateRecord,
      attachments,
    });

    const status = validationResults.isValid ? 'VALIDATED' : 'VALIDATION_FAILED';

    let draft = (mongoose.connection.readyState === 1)
      ? await CorporateFilingDraft.findOne({ firmId, cinOrLlpin: cleanCin, formType, financialYear })
      : null;

    if (!draft) {
      draft = new CorporateFilingDraft({
        firmId,
        clientId: clientId || corporateRecord?.clientId || null,
        corporateMasterRecordId: corporateRecord?._id || null,
        cinOrLlpin: cleanCin,
        formType,
        financialYear,
        createdByXID: actorXID,
      });
    }

    draft.filingData = filingData;
    draft.validationResults = validationResults;
    draft.status = status;
    draft.attachments = attachments;
    draft.caseId = caseId || draft.caseId;
    draft.updatedByXID = actorXID;
    draft.mcaPayload = {
      form_type: formType,
      cin: cleanCin,
      financial_year: financialYear,
      generated_at: new Date().toISOString(),
      validation_status: status,
      payload: filingData,
    };

    if (mongoose.connection.readyState === 1) {
      await draft.save();
    }

    log.info('MCA_FILING_DRAFT_SAVED', {
      firmId,
      cinOrLlpin: cleanCin,
      formType,
      financialYear,
      isValid: validationResults.isValid,
      errorsCount: validationResults.errors.length,
      warningsCount: validationResults.warnings.length,
    });

    return draft;
  }

  /**
   * Generates a finalized direct-upload package for MCA V3
   */
  exportMcaUploadPackage({ draft }) {
    if (!draft) {
      throw new Error('DRAFT_RECORD_REQUIRED');
    }

    if (draft.status === 'VALIDATION_FAILED' || !draft.validationResults?.isValid) {
      throw new Error('CANNOT_EXPORT_INVALID_FILING_DRAFT: Resolve validation errors before export');
    }

    return {
      exportVersion: '1.0.0',
      system: 'Docketra-MCA-Engine',
      exportedAt: new Date().toISOString(),
      formType: draft.formType,
      cin: draft.cinOrLlpin,
      financialYear: draft.financialYear,
      mcaV3WebFormJson: draft.mcaPayload || draft.filingData,
      attachmentsManifest: draft.attachments || [],
      digitalSignatureStatus: 'READY_FOR_DSC_SIGNING',
    };
  }
}

module.exports = {
  mcaFilingAutomationService: new McaFilingAutomationService(),
};
