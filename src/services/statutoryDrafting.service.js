'use strict';

const StatutoryDraftDocument = require('../models/StatutoryDraftDocument.model');
const CorporateMasterRecord = require('../models/CorporateMasterRecord.model');
const log = require('../utils/log');

function formatCurrencyINR(amount) {
  if (amount == null || isNaN(amount)) return '₹0.00';
  return '₹' + Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d) {
  if (!d) return 'N/A';
  const parsed = new Date(d);
  return Number.isNaN(parsed.getTime()) ? 'N/A' : parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

class StatutoryDraftingService {
  /**
   * Generates a statutory Board's Report pursuant to Section 134 of the Companies Act, 2013
   */
  generateBoardReport({
    corporateRecord,
    financialYear = '2025-2026',
    financialHighlights = {},
    boardMeetings = [],
    auditors = {},
    loansAndInvestments = [],
    relatedPartiesDisclosures = '',
    conservationEnergy = {},
    generalDisclosures = {},
    signatories = [],
  }) {
    if (!corporateRecord) {
      throw new Error('CORPORATE_RECORD_REQUIRED_FOR_DRAFTING');
    }

    const companyName = corporateRecord.companyName || 'THE COMPANY';
    const cin = corporateRecord.cinOrLlpin || 'N/A';
    const registeredAddress = corporateRecord.registeredOfficeAddress || 'Registered Office Address';
    const roc = corporateRecord.roc || 'N/A';
    const isPublic = corporateRecord.companyClass === 'PUBLIC';

    const previousFY = (() => {
      const parts = financialYear.split('-');
      if (parts.length === 2 && !isNaN(parts[0])) {
        const start = parseInt(parts[0], 10) - 1;
        const end = parseInt(parts[1], 10) - 1;
        return `${start}-${end}`;
      }
      return 'Previous FY';
    })();

    const cur = financialHighlights.currentYear || {};
    const prev = financialHighlights.previousYear || {};

    const activeDirectors = (corporateRecord.directors || []).filter(d => d.designation !== 'RESIGNED');
    const defaultSignatories = signatories.length > 0
      ? signatories
      : activeDirectors.slice(0, 2).map(d => ({
          fullName: d.fullName,
          din: d.din,
          designation: d.designation || 'Director',
        }));

    let markdown = `# BOARD'S REPORT

**To,**  
**The Members,**  
**${companyName}**  
**CIN: ${cin}**  
**Registered Office:** ${registeredAddress}  
**RoC Jurisdiction:** ${roc}  

Your Directors have immense pleasure in presenting the Annual Report of **${companyName}** together with the Audited Financial Statements, Independent Auditor’s Report, and the State of Affairs of the Company for the Financial Year ended **31st March, ${financialYear.split('-')[1] || '2026'}**.

---

## 1. FINANCIAL SUMMARY AND HIGHLIGHTS

The Company’s financial performance for the financial year under review along with comparative figures from the previous financial year are summarized below:

| Financial Metric | FY ${financialYear} (Amount in INR) | FY ${previousFY} (Amount in INR) |
| :--- | :---: | :---: |
| **Revenue from Operations** | ${formatCurrencyINR(cur.revenueFromOperations)} | ${formatCurrencyINR(prev.revenueFromOperations)} |
| **Other Income** | ${formatCurrencyINR(cur.otherIncome)} | ${formatCurrencyINR(prev.otherIncome)} |
| **Total Revenue** | **${formatCurrencyINR(cur.totalRevenue || (Number(cur.revenueFromOperations || 0) + Number(cur.otherIncome || 0)))}** | **${formatCurrencyINR(prev.totalRevenue || (Number(prev.revenueFromOperations || 0) + Number(prev.otherIncome || 0)))}** |
| **Total Expenses** | ${formatCurrencyINR(cur.totalExpenses)} | ${formatCurrencyINR(prev.totalExpenses)} |
| **Profit / (Loss) Before Exceptional Items & Tax** | ${formatCurrencyINR(cur.profitBeforeTax)} | ${formatCurrencyINR(prev.profitBeforeTax)} |
| **Current Tax / Deferred Tax** | ${formatCurrencyINR(cur.taxExpense)} | ${formatCurrencyINR(prev.taxExpense)} |
| **Profit / (Loss) After Tax (PAT)** | **${formatCurrencyINR(cur.profitAfterTax)}** | **${formatCurrencyINR(prev.profitAfterTax)}** |
| **Transfer to General Reserve** | ${formatCurrencyINR(cur.transferToReserves || 0)} | ${formatCurrencyINR(prev.transferToReserves || 0)} |

---

## 2. STATE OF COMPANY'S AFFAIRS & OPERATIONAL REVIEW
${generalDisclosures.stateOfAffairs || `During the financial year ended 31st March, ${financialYear.split('-')[1] || '2026'}, the Company continued its normal business operations with operational stability. The management remains committed to strategic growth, technological innovation, and client satisfaction while maintaining stringent fiscal discipline.`}

## 3. DIVIDEND
${cur.dividendRecommended ? `The Board of Directors is pleased to recommend a dividend of ${cur.dividendRecommended} per equity share for the financial year ended 31st March, ${financialYear.split('-')[1] || '2026'}, subject to approval of the members at the ensuing Annual General Meeting.` : `In order to conserve liquid resources and support future operational expansions, your Directors do not recommend any dividend on equity shares for the financial year under review.`}

## 4. TRANSFER TO RESERVES
${cur.transferToReserves > 0 ? `The Board proposes to transfer an amount of ${formatCurrencyINR(cur.transferToReserves)} to the General Reserve of the Company.` : `No amount has been transferred to General Reserve for the financial year under review; the entire net profit for the year has been carried to the surplus in the Statement of Profit and Loss.`}

## 5. MEETINGS OF THE BOARD OF DIRECTORS
During the financial year under review, the Board of Directors met ${boardMeetings.length > 0 ? boardMeetings.length : '4 (Four)'} times in compliance with Section 173 of the Companies Act, 2013 and Secretarial Standard-1 (SS-1). The maximum gap between any two consecutive meetings did not exceed one hundred and twenty (120) days.

| Meeting No. | Date of Meeting | Board Strength | Directors Present |
| :---: | :---: | :---: | :---: |
${boardMeetings.length > 0
  ? boardMeetings.map((m, idx) => `| ${idx + 1} | ${formatDate(m.date)} | ${m.totalDirectors || activeDirectors.length} | ${m.attendeesCount || activeDirectors.length} |`).join('\n')
  : `| 1 | Q1 Meeting | ${activeDirectors.length} | ${activeDirectors.length} |\n| 2 | Q2 Meeting | ${activeDirectors.length} | ${activeDirectors.length} |\n| 3 | Q3 Meeting | ${activeDirectors.length} | ${activeDirectors.length} |\n| 4 | Q4 Meeting | ${activeDirectors.length} | ${activeDirectors.length} |`
}

---

## 6. DIRECTORS AND KEY MANAGERIAL PERSONNEL
As of 31st March, ${financialYear.split('-')[1] || '2026'}, the Board of Directors comprises the following members:

| Director / KMP Name | DIN / PAN | Designation | Appointment Date |
| :--- | :---: | :---: | :---: |
${activeDirectors.map(d => `| **${d.fullName}** | ${d.din || 'N/A'} | ${d.designation} | ${formatDate(d.appointmentDate)} |`).join('\n')}

${generalDisclosures.directorChanges || 'There were no changes in the composition of the Board of Directors during the financial year under review.'}

---

## 7. DIRECTORS' RESPONSIBILITY STATEMENT (SECTION 134(5))
Pursuant to the requirement under Section 134(3)(c) and Section 134(5) of the Companies Act, 2013, with respect to Directors' Responsibility Statement, your Directors confirm that:
1. In the preparation of the annual accounts for the financial year ended 31st March, ${financialYear.split('-')[1] || '2026'}, the applicable accounting standards have been followed along with proper explanations relating to material departures;
2. The Directors have selected such accounting policies and applied them consistently and made judgments and estimates that are reasonable and prudent so as to give a true and fair view of the state of affairs of the Company as at 31st March, ${financialYear.split('-')[1] || '2026'} and of the profit of the Company for that period;
3. The Directors have taken proper and sufficient care for the maintenance of adequate accounting records in accordance with the provisions of the Companies Act, 2013 for safeguarding the assets of the Company and for preventing and detecting fraud and other irregularities;
4. The Directors have prepared the annual financial statements on a 'going concern' basis;
5. ${isPublic ? 'The Directors have laid down internal financial controls to be followed by the Company and that such internal financial controls are adequate and operating effectively;' : 'The Directors have devised proper systems to ensure compliance with the provisions of all applicable laws and that such systems are adequate and operating effectively;' }
6. The Directors have devised proper systems to ensure compliance with the provisions of all applicable laws and that such systems were adequate and operating effectively.

---

## 8. STATUTORY AUDITORS & AUDITOR'S REPORT
**M/s ${auditors.firmName || 'Statutory Auditors & Co., Chartered Accountants'}** (Firm Registration No. ${auditors.frn || 'XXXXX'}), Statutory Auditors of the Company, have audited the financial accounts of the Company for the year under review.

${auditors.hasQualifications ? `**Explanation to Auditor's Qualifications/Reservations:**\n${auditors.qualificationExplanations || 'The notes on financial statements referred to in the Auditors’ Report are self-explanatory.'}` : `The Independent Auditor's Report for the financial year ended 31st March, ${financialYear.split('-')[1] || '2026'} does not contain any qualification, reservation, adverse remark, or disclaimer.`}

---

## 9. PARTICULARS OF LOANS, GUARANTEES OR INVESTMENTS (SECTION 186)
${loansAndInvestments.length > 0 ? `Particulars of loans given, investments made, guarantees given, and securities provided under Section 186 of the Companies Act, 2013 are detailed in the notes to the Financial Statements.` : `During the financial year under review, the Company has not given any loans, guarantees, or made investments covered under the provisions of Section 186 of the Companies Act, 2013.`}

---

## 10. RELATED PARTY TRANSACTIONS (SECTION 188)
${relatedPartiesDisclosures || `All contracts / arrangements / transactions entered into by the Company during the financial year with related parties were in the ordinary course of business and on an arm’s length basis. Form **AOC-2** containing details of related party transactions is attached herewith as **Annexure-A**.`}

---

## 11. CONSERVATION OF ENERGY, TECHNOLOGY ABSORPTION & FOREIGN EXCHANGE EARNINGS / OUTGO
Pursuant to Section 134(3)(m) read with Rule 8 of the Companies (Accounts) Rules, 2014:
* **(A) Conservation of Energy:** The operations of the Company do not consume substantial energy. However, necessary measures are continuously taken to prevent wastage of electricity and conserve resources.
* **(B) Technology Absorption:** The Company utilizes modern cloud and automated platforms in its operations to maximize operating efficiencies and minimize paper dependency.
* **(C) Foreign Exchange Earnings and Outgo:**
  * Foreign Exchange Earned: ${formatCurrencyINR(conservationEnergy.forexEarned || 0)}
  * Foreign Exchange Outgo: ${formatCurrencyINR(conservationEnergy.forexOutgo || 0)}

---

## 12. RISK MANAGEMENT & INTERNAL CONTROLS
The Company maintains an internal control framework commensurate with the size and nature of its business. Operational and compliance risks are periodically reviewed to ensure adherence to statutory norms.

---

## 13. ACKNOWLEDGEMENTS
Your Directors place on record their sincere gratitude and appreciation for the assistance, cooperation, and support received from banks, government authorities, clients, vendors, and business associates. The Directors also convey their heartfelt appreciation to all employees for their dedicated contribution.

**For and on behalf of the Board of Directors**  
**${companyName}**  

<br/><br/>

| | |
| :--- | :--- |
${defaultSignatories.map(s => `| **${s.fullName}**<br/>${s.designation}<br/>DIN: ${s.din || 'N/A'} |`).join('\n')}

**Date:** ${formatDate(new Date())}  
**Place:** ${registeredAddress.split(',').slice(-2)[0]?.trim() || 'Jaipur'}
`;

    return markdown;
  }

  /**
   * Generates Form AOC-1: Salient features of financial statements of subsidiaries / associate companies
   * Pursuant to first proviso to sub-section (3) of section 129 read with rule 5 of Companies (Accounts) Rules, 2014
   */
  generateAoc1({
    corporateRecord,
    financialYear = '2025-2026',
    subsidiaries = [],
    associates = [],
  }) {
    const companyName = corporateRecord.companyName || 'THE COMPANY';
    const cin = corporateRecord.cinOrLlpin || 'N/A';

    let markdown = `# FORM AOC-1
*(Pursuant to first proviso to sub-section (3) of section 129 read with rule 5 of Companies (Accounts) Rules, 2014)*  
**Statement containing salient features of the financial statement of Subsidiaries / Associate Companies / Joint Ventures**  

**Name of the Holding Company:** **${companyName}**  
**CIN:** **${cin}**  
**Financial Year ended on:** **31st March, ${financialYear.split('-')[1] || '2026'}**  

---

### PART "A": SUBSIDIARIES

${subsidiaries.length === 0 ? '*The Company does not have any Subsidiary Company as on 31st March, ' + (financialYear.split('-')[1] || '2026') + '.*' : `
| S.No. | Name of Subsidiary | Reporting Currency | Share Capital | Reserves & Surplus | Total Assets | Total Liabilities | Investments | Turnover | Profit Before Tax | Provision for Tax | Profit After Tax | % Shareholding |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
${subsidiaries.map((s, idx) => `| ${idx + 1} | **${s.name}** | ${s.currency || 'INR'} | ${formatCurrencyINR(s.shareCapital)} | ${formatCurrencyINR(s.reserves)} | ${formatCurrencyINR(s.totalAssets)} | ${formatCurrencyINR(s.totalLiabilities)} | ${formatCurrencyINR(s.investments || 0)} | ${formatCurrencyINR(s.turnover)} | ${formatCurrencyINR(s.pbt)} | ${formatCurrencyINR(s.tax)} | ${formatCurrencyINR(s.pat)} | ${s.percentageHolding || 100}% |`).join('\n')}
`}

---

### PART "B": ASSOCIATES AND JOINT VENTURES

${associates.length === 0 ? '*The Company does not have any Associate Company or Joint Venture as on 31st March, ' + (financialYear.split('-')[1] || '2026') + '.*' : `
| S.No. | Name of Associate / Joint Venture | Latest Audited Balance Sheet Date | No. of Shares Held | Amount of Investment | % Holding | Description of Significant Influence | Net Worth Attributable | Profit / (Loss) for the year |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
${associates.map((a, idx) => `| ${idx + 1} | **${a.name}** | ${formatDate(a.balanceSheetDate)} | ${a.sharesCount || 0} | ${formatCurrencyINR(a.investmentAmount)} | ${a.percentageHolding}% | ${a.influenceReason || 'By voting power > 20%'} | ${formatCurrencyINR(a.netWorth)} | ${formatCurrencyINR(a.profit)} |`).join('\n')}
`}

---

**For and on behalf of the Board of Directors**  
**${companyName}**  

<br/>
**Date:** ${formatDate(new Date())}  
**Place:** ${corporateRecord.registeredOfficeAddress ? corporateRecord.registeredOfficeAddress.split(',').slice(-2)[0]?.trim() : 'India'}
`;

    return markdown;
  }

  /**
   * Generates Form AOC-2: Particulars of contracts/arrangements with related parties
   * Pursuant to clause (h) of sub-section (3) of section 134 and Rule 8(2) of Companies (Accounts) Rules, 2014
   */
  generateAoc2({
    corporateRecord,
    financialYear = '2025-2026',
    contractsNotArmLength = [],
    contractsArmLength = [],
  }) {
    const companyName = corporateRecord.companyName || 'THE COMPANY';
    const cin = corporateRecord.cinOrLlpin || 'N/A';

    let markdown = `# FORM AOC-2
*(Pursuant to clause (h) of sub-section (3) of section 134 of the Act and Rule 8(2) of the Companies (Accounts) Rules, 2014)*  
**Form for disclosure of particulars of contracts/arrangements entered into by the company with related parties referred to in sub-section (1) of section 188 of the Companies Act, 2013 including certain arm's length transactions under third proviso thereto**  

**Company Name:** **${companyName}**  
**CIN:** **${cin}**  
**Financial Year:** **${financialYear}**  

---

### 1. DETAILS OF CONTRACTS OR ARRANGEMENTS OR TRANSACTIONS NOT AT ARM'S LENGTH BASIS
${contractsNotArmLength.length === 0 ? '*There were no contracts or arrangements or transactions entered into during the year ended 31st March, ' + (financialYear.split('-')[1] || '2026') + ' which were not at arm’s length basis.*' : `
| S.No. | Name of Related Party & Relationship | Nature of Contract | Duration | Salient Terms | Justification | Board Approval Date | Amount Paid as Advance |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: | :---: |
${contractsNotArmLength.map((c, idx) => `| ${idx + 1} | **${c.partyName}** (${c.relationship}) | ${c.contractNature} | ${c.duration} | ${c.salientTerms} | ${c.justification} | ${formatDate(c.approvalDate)} | ${formatCurrencyINR(c.advancePaid || 0)} |`).join('\n')}
`}

---

### 2. DETAILS OF MATERIAL CONTRACTS OR ARRANGEMENT OR TRANSACTIONS AT ARM'S LENGTH BASIS
${contractsArmLength.length === 0 ? '*All contracts or arrangements or transactions entered into with related parties were in the ordinary course of business and on an arm’s length basis, below material thresholds.*' : `
| S.No. | Name of Related Party & Relationship | Nature of Contract | Duration | Salient Terms & Monetary Value | Board Approval Date | Amount Paid as Advance |
| :---: | :--- | :--- | :--- | :--- | :---: | :---: |
${contractsArmLength.map((c, idx) => `| ${idx + 1} | **${c.partyName}** (${c.relationship}) | ${c.contractNature} | ${c.duration} | Value: ${formatCurrencyINR(c.amount)}. ${c.salientTerms || ''} | ${formatDate(c.approvalDate)} | ${formatCurrencyINR(c.advancePaid || 0)} |`).join('\n')}
`}

---

**For and on behalf of the Board of Directors**  
**${companyName}**  

<br/>
**Date:** ${formatDate(new Date())}  
**Place:** ${corporateRecord.registeredOfficeAddress ? corporateRecord.registeredOfficeAddress.split(',').slice(-2)[0]?.trim() : 'India'}
`;

    return markdown;
  }

  /**
   * Generates Form MGT-9: Extract of Annual Return
   * Pursuant to section 92(3) and Rule 12(1) of Companies (Management and Administration) Rules, 2014
   */
  generateMgt9({
    corporateRecord,
    financialYear = '2025-2026',
    principalActivities = [],
    shareholdingPattern = {},
    indebtedness = {},
  }) {
    const companyName = corporateRecord.companyName || 'THE COMPANY';
    const cin = corporateRecord.cinOrLlpin || 'N/A';
    const roc = corporateRecord.roc || 'N/A';
    const incDate = corporateRecord.incorporationDate ? formatDate(corporateRecord.incorporationDate) : 'N/A';

    let markdown = `# FORM MGT-9
*(Pursuant to Section 92(3) of the Companies Act, 2013 and Rule 12(1) of the Companies (Management and Administration) Rules, 2014)*  
### EXTRACT OF ANNUAL RETURN AS ON FINANCIAL YEAR ENDED ON 31ST MARCH, ${financialYear.split('-')[1] || '2026'}

---

### I. REGISTRATION AND OTHER PARTICULARS
* **CIN:** ${cin}
* **Registration Date:** ${incDate}
* **Name of the Company:** **${companyName}**
* **Category / Sub-Category:** ${corporateRecord.companyCategory || 'Company limited by Shares'} / ${corporateRecord.companyClass || 'Private Company'}
* **Address of the Registered Office:** ${corporateRecord.registeredOfficeAddress || 'N/A'}
* **Email Address:** ${corporateRecord.registeredEmail || 'N/A'}
* **Whether Listed Company:** ${corporateRecord.companyClass === 'PUBLIC' ? 'Yes' : 'No'}
* **Name, Address and Contact details of Registrar and Transfer Agent (RTA):** ${shareholdingPattern.rtaDetails || 'N/A (Managed In-house)'}

---

### II. PRINCIPAL BUSINESS ACTIVITIES OF THE COMPANY
All the business activities contributing 10% or more of the total turnover of the company shall be stated:

| S.No. | Name and Description of main products / services | NIC Code of the Product/service | % to total turnover of the company |
| :---: | :--- | :---: | :---: |
${principalActivities.length > 0
  ? principalActivities.map((a, idx) => `| ${idx + 1} | ${a.name} | ${a.nicCode || 'N/A'} | ${a.turnoverPercentage || 100}% |`).join('\n')
  : '| 1 | IT Consulting and Corporate Secretarial Services | 62099 | 100% |'
}

---

### III. SHAREHOLDING PATTERN (Equity Share Capital Breakup as % of Total Equity)
* **Authorized Share Capital:** ${formatCurrencyINR(corporateRecord.authorizedCapital || 0)}
* **Issued & Paid-up Share Capital:** ${formatCurrencyINR(corporateRecord.paidUpCapital || 0)}

| Category of Shareholders | No. of Shares Held at Beginning of Year | % of Total Shares | No. of Shares Held at End of Year | % of Total Shares | % Change During the Year |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **A. Promoters** | ${shareholdingPattern.promotersCount || '10,000'} | 100.00% | ${shareholdingPattern.promotersCount || '10,000'} | 100.00% | 0.00% |
| **B. Public** | 0 | 0.00% | 0 | 0.00% | 0.00% |
| **Total (A + B)** | **${shareholdingPattern.totalShares || '10,000'}** | **100.00%** | **${shareholdingPattern.totalShares || '10,000'}** | **100.00%** | **0.00%** |

---

### IV. INDEBTEDNESS
Indebtedness of the Company including interest outstanding/accrued but not due for payment:

| Particulars | Secured Loans (excluding deposits) | Unsecured Loans | Deposits | Total Indebtedness |
| :--- | :---: | :---: | :---: | :---: |
| Indebtedness at the beginning of the FY | ${formatCurrencyINR(indebtedness.securedStart || 0)} | ${formatCurrencyINR(indebtedness.unsecuredStart || 0)} | ₹0.00 | ${formatCurrencyINR((indebtedness.securedStart || 0) + (indebtedness.unsecuredStart || 0))} |
| Change in Indebtedness during the FY | ${formatCurrencyINR(indebtedness.netChange || 0)} | ₹0.00 | ₹0.00 | ${formatCurrencyINR(indebtedness.netChange || 0)} |
| **Indebtedness at the end of the FY** | **${formatCurrencyINR(indebtedness.securedEnd || (corporateRecord.charges || []).reduce((acc, c) => acc + (c.status === 'OPEN' ? c.amount : 0), 0))}** | **${formatCurrencyINR(indebtedness.unsecuredEnd || 0)}** | **₹0.00** | **${formatCurrencyINR((indebtedness.securedEnd || (corporateRecord.charges || []).reduce((acc, c) => acc + (c.status === 'OPEN' ? c.amount : 0), 0)) + (indebtedness.unsecuredEnd || 0))}** |

---

**For and on behalf of the Board of Directors**  
**${companyName}**  

<br/>
**Date:** ${formatDate(new Date())}  
**Place:** ${corporateRecord.registeredOfficeAddress ? corporateRecord.registeredOfficeAddress.split(',').slice(-2)[0]?.trim() : 'India'}
`;

    return markdown;
  }

  /**
   * Saves or versions a drafted statutory document
   */
  async saveDraftDocument({
    firmId,
    clientId,
    cinOrLlpin,
    financialYear,
    documentType,
    title,
    content,
    inputParameters = {},
    actorXID = 'SYSTEM',
    caseId = null,
  }) {
    if (!firmId || !cinOrLlpin || !documentType || !financialYear || !content) {
      throw new Error('STATUTORY_DRAFT_MISSING_REQUIRED_FIELDS');
    }

    const cleanCin = cinOrLlpin.trim().toUpperCase();

    // Check if CorporateMasterRecord exists to link (only if DB connection is active)
    const mongoose = require('mongoose');
    const corporateRecord = (mongoose.connection.readyState === 1)
      ? await CorporateMasterRecord.findOne({ firmId, cinOrLlpin: cleanCin })
      : null;

    // Look for highest existing version
    const existing = await StatutoryDraftDocument.findOne({
      firmId,
      cinOrLlpin: cleanCin,
      documentType,
      financialYear,
    }).sort({ version: -1 });

    const newVersion = existing ? existing.version + 1 : 1;

    const draft = new StatutoryDraftDocument({
      firmId,
      clientId: clientId || corporateRecord?.clientId || null,
      corporateMasterRecordId: corporateRecord?._id || null,
      cinOrLlpin: cleanCin,
      financialYear,
      documentType,
      title: title || `${documentType.replace('_', ' ')} - FY ${financialYear}`,
      version: newVersion,
      status: 'DRAFT',
      caseId: caseId || null,
      content,
      inputParameters,
      signatories: (corporateRecord?.directors || []).slice(0, 2).map(d => ({
        din: d.din,
        fullName: d.fullName,
        designation: d.designation,
      })),
      createdByXID: actorXID,
    });

    await draft.save();

    log.info('STATUTORY_DRAFT_DOCUMENT_SAVED', {
      firmId,
      cinOrLlpin: cleanCin,
      documentType,
      version: newVersion,
      draftId: draft._id,
    });

    return draft;
  }

  /**
   * Connects drafted document to client approval workflow
   */
  async requestClientSignOff({
    draftId,
    firmId,
    approverEmail,
    approverXID,
    approvalType = 'client',
    actorXID = 'SYSTEM',
    caseId = null,
  }) {
    const draft = await StatutoryDraftDocument.findOne({ _id: draftId, firmId });
    if (!draft) {
      throw new Error('STATUTORY_DRAFT_NOT_FOUND');
    }

    draft.status = 'AWAITING_CLIENT_SIGN_OFF';
    draft.approvalRef = {
      approvalType,
      requestedAt: new Date(),
      approverXID: approverXID || null,
      approverEmail: approverEmail || null,
      decision: 'pending',
      decisionComment: '',
      decidedAt: null,
    };
    draft.updatedByXID = actorXID;

    if (caseId) {
      draft.caseId = caseId;
      // Connect to docketApproval.service if caseId is passed
      try {
        const { requestDocketApproval } = require('./docketApproval.service');
        if (requestDocketApproval) {
          await requestDocketApproval({
            docketId: caseId,
            firmId,
            approvalType,
            requestedBy: actorXID,
            approver: approverXID || approverEmail || 'CLIENT_DIRECTOR',
            comments: `Statutory approval request for ${draft.title} (${draft.documentType})`,
          });
        }
      } catch (err) {
        log.warn('DOCKET_APPROVAL_INTEGRATION_OPTIONAL_SKIPPED', { error: err.message });
      }
    }

    await draft.save();

    log.info('STATUTORY_DRAFT_SUBMITTED_FOR_SIGN_OFF', {
      draftId: draft._id,
      firmId,
      status: draft.status,
      approverEmail,
    });

    return draft;
  }
}

module.exports = {
  statutoryDraftingService: new StatutoryDraftingService(),
};
