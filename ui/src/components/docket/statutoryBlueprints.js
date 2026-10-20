/**
 * Statutory Blueprints for Indian CA / CS / Legal Compliance Practices
 * Pre-defined statutory workflows with standard titles, descriptions, priorities,
 * intelligent category routing matching, and mandatory compliance checklists.
 */

export const STATUTORY_BLUEPRINTS = [
  {
    id: 'tax_audit_3cd',
    name: 'Tax Audit (Form 3CD)',
    shortName: 'Tax Audit 3CD',
    workType: 'Direct Tax',
    authority: 'Income Tax',
    categoryKeywords: ['direct tax', 'taxation', 'income tax', 'tax audit', 'audit', 'compliance'],
    subcategoryKeywords: ['tax audit', '3cd', 'form 3cd', 'section 44ab', 'audit report', 'statutory audit'],
    defaultTitle: 'Tax Audit u/s 44AB (Form 3CD) - FY 2025-26',
    defaultPriority: 'high',
    defaultDescription: 'Statutory tax audit under Section 44AB of the Income Tax Act. Verification of books, ledger scrutiny, Form 3CA/3CB certification, and Form 3CD particulars.',
    checklist: [
      { id: '3cd-1', title: 'Books & trial balance reconciliation with audited financials', required: true, dueOffsetDays: 3 },
      { id: '3cd-2', title: 'TDS/TCS deduction & deposit reconciliation with Form 26AS/AIS', required: true, dueOffsetDays: 5 },
      { id: '3cd-3', title: 'Fixed assets register & depreciation schedule as per Sec 32', required: true, dueOffsetDays: 7 },
      { id: '3cd-4', title: 'Section 40(a)(ia), 40A(2), and 40A(3) disallowance scrutiny', required: true, dueOffsetDays: 9 },
      { id: '3cd-5', title: 'MSME 45-day overdue payment review u/s 43B(h)', required: true, dueOffsetDays: 10 },
      { id: '3cd-6', title: 'Draft Form 3CD annexures and partner technical sign-off', required: true, dueOffsetDays: 12 },
      { id: '3cd-7', title: 'Client management representation letter & signature', required: true, dueOffsetDays: 14 },
      { id: '3cd-8', title: 'ICAI UDIN generation and upload on e-Filing portal', required: true, dueOffsetDays: 15 },
    ],
  },
  {
    id: 'roc_annual_filing',
    name: 'ROC Annual Filing (AOC-4 / MGT-7)',
    shortName: 'ROC AOC-4 / MGT-7',
    workType: 'MCA / Secretarial',
    authority: 'MCA / ROC',
    categoryKeywords: ['mca', 'roc', 'secretarial', 'corporate', 'company law', 'compliance'],
    subcategoryKeywords: ['annual filing', 'aoc-4', 'mgt-7', 'roc filing', 'annual return', 'mca filing'],
    defaultTitle: 'ROC Annual Filing (Form AOC-4 & MGT-7) - FY 2024-25',
    defaultPriority: 'medium',
    defaultDescription: 'Annual statutory company compliance under Companies Act, 2013. Filing of balance sheet/financial statements (AOC-4) and annual return (MGT-7/7A) with ROC.',
    checklist: [
      { id: 'roc-1', title: 'Notice, agenda, and minutes of AGM approval', required: true, dueOffsetDays: 2 },
      { id: 'roc-2', title: 'Signed Directors Report with secretarial annexures', required: true, dueOffsetDays: 4 },
      { id: 'roc-3', title: 'Audited Financial Statements (Balance Sheet, P&L, Notes)', required: true, dueOffsetDays: 6 },
      { id: 'roc-4', title: 'Form AOC-4 / AOC-4 XBRL drafting & pre-scrutiny', required: true, dueOffsetDays: 8 },
      { id: 'roc-5', title: 'Form MGT-7 / MGT-7A (Annual Return) preparation', required: true, dueOffsetDays: 10 },
      { id: 'roc-6', title: 'Director and Professional DSC affixation', required: true, dueOffsetDays: 12 },
      { id: 'roc-7', title: 'MCA V3 portal upload, payment challan & SRN archiving', required: true, dueOffsetDays: 14 },
    ],
  },
  {
    id: 'dir3_kyc',
    name: 'Director DIR-3 KYC',
    shortName: 'DIR-3 KYC',
    workType: 'MCA / Compliance',
    authority: 'MCA / DIN',
    categoryKeywords: ['mca', 'roc', 'secretarial', 'compliance', 'corporate'],
    subcategoryKeywords: ['dir-3 kyc', 'director kyc', 'dir-3', 'kyc', 'din'],
    defaultTitle: 'Director Annual KYC (Form DIR-3 KYC / Web KYC)',
    defaultPriority: 'medium',
    defaultDescription: 'Mandatory annual DIN verification for active directors under Rule 12A of Companies (Appointment and Qualification of Directors) Rules.',
    checklist: [
      { id: 'kyc-1', title: 'Verify Director PAN and Aadhaar against MCA database', required: true, dueOffsetDays: 1 },
      { id: 'kyc-2', title: 'Confirm active personal mobile & email for OTP verification', required: true, dueOffsetDays: 2 },
      { id: 'kyc-3', title: 'Passport / residential proof check (if details modified)', required: false, dueOffsetDays: 3 },
      { id: 'kyc-4', title: 'Web KYC OTP submission or e-Form DIR-3 KYC preparation', required: true, dueOffsetDays: 4 },
      { id: 'kyc-5', title: 'DSC certification (for e-Form) and MCA portal filing', required: true, dueOffsetDays: 5 },
      { id: 'kyc-6', title: 'Download and archive SRN challan & approval confirmation', required: true, dueOffsetDays: 6 },
    ],
  },
  {
    id: 'gst_monthly',
    name: 'GST Monthly Return (GSTR-1 & 3B)',
    shortName: 'GST GSTR-1 & 3B',
    workType: 'Indirect Tax',
    authority: 'GSTN',
    categoryKeywords: ['gst', 'indirect tax', 'taxation', 'compliance', 'returns', 'accounting'],
    subcategoryKeywords: ['gstr-3b', 'gstr-1', 'gst return', 'monthly return', 'gst filing', 'gstr'],
    defaultTitle: 'GST Monthly Compliance (GSTR-1 & GSTR-3B)',
    defaultPriority: 'high',
    defaultDescription: 'Monthly statutory filing for outward supplies (GSTR-1) and monthly summary return with ITC reconciliation (GSTR-3B).',
    checklist: [
      { id: 'gst-1', title: 'Outward sales & e-invoice reconciliation with GSTR-1 draft', required: true, dueOffsetDays: 2 },
      { id: 'gst-2', title: 'Inward purchase register reconciliation with GSTR-2B ITC', required: true, dueOffsetDays: 4 },
      { id: 'gst-3', title: 'Identify & reverse ineligible ITC under Rule 38/42/43', required: true, dueOffsetDays: 5 },
      { id: 'gst-4', title: 'File GSTR-1 on GST portal via DSC or EVC', required: true, dueOffsetDays: 7 },
      { id: 'gst-5', title: 'Calculate tax liability, cash ledger top-up, & PMT-06 challan', required: true, dueOffsetDays: 9 },
      { id: 'gst-6', title: 'File GSTR-3B return with tax set-off', required: true, dueOffsetDays: 10 },
      { id: 'gst-7', title: 'Archive filed return PDFs and share challans with client', required: true, dueOffsetDays: 11 },
    ],
  },
  {
    id: 'fema_fla',
    name: 'FEMA FLA Annual Return',
    shortName: 'FEMA FLA (RBI)',
    workType: 'RBI / FEMA',
    authority: 'RBI',
    categoryKeywords: ['fema', 'rbi', 'corporate', 'compliance', 'legal', 'secretarial'],
    subcategoryKeywords: ['fla', 'foreign liabilities', 'rbi return', 'fema filing', 'fdi'],
    defaultTitle: 'FEMA FLA Annual Return - Foreign Liabilities and Assets',
    defaultPriority: 'medium',
    defaultDescription: 'Annual reporting of Foreign Liabilities and Assets under FEMA Regulations to the Reserve Bank of India on the FLAIR portal.',
    checklist: [
      { id: 'fla-1', title: 'Audited financials & foreign shareholding pattern review', required: true, dueOffsetDays: 3 },
      { id: 'fla-2', title: 'Verify FDI/ODI inward/outward remittances and FCGPR/APR filings', required: true, dueOffsetDays: 5 },
      { id: 'fla-3', title: 'Compute net worth and foreign equity/debt valuation as per RBI', required: true, dueOffsetDays: 7 },
      { id: 'fla-4', title: 'Draft FLA return form and partner technical sign-off', required: true, dueOffsetDays: 10 },
      { id: 'fla-5', title: 'Submit FLA annual return on RBI FLAIR portal', required: true, dueOffsetDays: 12 },
      { id: 'fla-6', title: 'Download confirmation acknowledgement and archive in vault', required: true, dueOffsetDays: 13 },
    ],
  },
];

export const getBlueprintById = (id) => STATUTORY_BLUEPRINTS.find((bp) => bp.id === id) || null;

/**
 * Intelligent matching of a statutory blueprint to the firm's configured categories and subcategories.
 * Prioritizes exact or strong keyword matches across active categories and subcategories.
 */
export const matchBlueprintToCategories = (categories = [], blueprint) => {
  if (!blueprint || !Array.isArray(categories) || categories.length === 0) {
    return { categoryId: '', subcategoryId: '', matchedCategory: null, matchedSubcategory: null };
  }

  const categoryKeywords = blueprint.categoryKeywords || [];
  const subcategoryKeywords = blueprint.subcategoryKeywords || [];

  const textMatches = (text, keywords) => {
    const lower = String(text || '').trim().toLowerCase();
    if (!lower) return false;
    return keywords.some((kw) => lower.includes(kw.toLowerCase()));
  };

  let bestCategory = null;
  let bestSubcategory = null;

  for (const cat of categories) {
    if (cat?.isActive === false) continue;
    const catNameMatch = textMatches(cat?.name, categoryKeywords);

    const activeSubcategories = (cat?.subcategories || []).filter((sub) => sub?.isActive !== false);
    const matchedSub = activeSubcategories.find((sub) => textMatches(sub?.name, subcategoryKeywords));

    if (catNameMatch && matchedSub) {
      return {
        categoryId: String(cat._id || cat.id || ''),
        subcategoryId: String(matchedSub.id || matchedSub._id || ''),
        matchedCategory: cat,
        matchedSubcategory: matchedSub,
      };
    }

    if (matchedSub && !bestSubcategory) {
      bestCategory = cat;
      bestSubcategory = matchedSub;
    } else if (catNameMatch && !bestCategory) {
      bestCategory = cat;
    }
  }

  if (bestCategory && bestSubcategory) {
    return {
      categoryId: String(bestCategory._id || bestCategory.id || ''),
      subcategoryId: String(bestSubcategory.id || bestSubcategory._id || ''),
      matchedCategory: bestCategory,
      matchedSubcategory: bestSubcategory,
    };
  }

  if (bestCategory) {
    return {
      categoryId: String(bestCategory._id || bestCategory.id || ''),
      subcategoryId: '',
      matchedCategory: bestCategory,
      matchedSubcategory: null,
    };
  }

  return { categoryId: '', subcategoryId: '', matchedCategory: null, matchedSubcategory: null };
};
