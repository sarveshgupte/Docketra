'use strict';

const mongoose = require('mongoose');
const { tenantScopeGuardPlugin } = require('./plugins/tenantScopeGuard.plugin');

const AttachmentManifestSchema = new mongoose.Schema({
  attachmentType: {
    type: String,
    required: true,
    enum: [
      'BALANCE_SHEET',
      'AUDIT_REPORT',
      'BOARD_REPORT',
      'CARO_REPORT',
      'NOTICE_OF_AGM',
      'AOC_1_SUBSIDIARIES',
      'AOC_2_RELATED_PARTY',
      'CSR_2_REPORT',
      'SHAREHOLDERS_LIST',
      'MGT_8_SECRETARIAL_CERTIFICATE',
      'OTHER_OPTIONAL',
    ],
  },
  title: { type: String, required: true, trim: true },
  isMandatory: { type: Boolean, default: true },
  isAttached: { type: Boolean, default: false },
  fileId: { type: String, trim: true, default: null },
  fileName: { type: String, trim: true, default: null },
  fileSize: { type: Number, default: 0 },
}, { _id: false });

const ValidationErrorSchema = new mongoose.Schema({
  field: { type: String, required: true },
  message: { type: String, required: true },
  code: { type: String, required: true },
  severity: { type: String, enum: ['ERROR', 'WARNING'], default: 'ERROR' },
}, { _id: false });

const corporateFilingDraftSchema = new mongoose.Schema({
  firmId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Firm',
    required: true,
    index: true,
  },
  clientId: {
    type: String,
    trim: true,
    index: true,
    default: null,
  },
  corporateMasterRecordId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CorporateMasterRecord',
    default: null,
    index: true,
  },
  cinOrLlpin: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    index: true,
  },
  formType: {
    type: String,
    enum: [
      'AOC_4',
      'AOC_4_CFS',
      'AOC_4_XBRL',
      'MGT_7',
      'MGT_7A',
      'CHG_1',
      'CHG_4',
    ],
    required: true,
    index: true,
  },
  financialYear: {
    type: String,
    required: true,
    trim: true,
    index: true,
    // e.g. "2025-2026"
  },
  status: {
    type: String,
    enum: ['DRAFT', 'VALIDATION_FAILED', 'VALIDATED', 'READY_FOR_UPLOAD', 'FILED', 'APPROVED'],
    default: 'DRAFT',
    index: true,
  },
  caseId: {
    type: String,
    trim: true,
    default: null,
    index: true,
  },
  filingData: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({}),
  },
  validationResults: {
    isValid: { type: Boolean, default: false },
    checkedRulesCount: { type: Number, default: 0 },
    errors: [ValidationErrorSchema],
    warnings: [ValidationErrorSchema],
    validatedAt: { type: Date, default: null },
  },
  attachments: [AttachmentManifestSchema],
  mcaPayload: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  srn: {
    type: String,
    trim: true,
    default: null,
    index: true,
  },
  filedAt: {
    type: Date,
    default: null,
  },
  createdByXID: {
    type: String,
    required: true,
    trim: true,
  },
  updatedByXID: {
    type: String,
    trim: true,
    default: null,
  },
}, {
  timestamps: true,
  collection: 'corporateFilingDrafts',
});

// Firm-scoped unique index per form type and FY
corporateFilingDraftSchema.index(
  { firmId: 1, cinOrLlpin: 1, formType: 1, financialYear: 1 },
  { unique: true, name: 'firm_filing_draft_unique' }
);

corporateFilingDraftSchema.plugin(tenantScopeGuardPlugin);

module.exports = mongoose.model('CorporateFilingDraft', corporateFilingDraftSchema);
