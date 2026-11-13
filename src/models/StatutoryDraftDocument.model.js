'use strict';

const mongoose = require('mongoose');
const { tenantScopeGuardPlugin } = require('./plugins/tenantScopeGuard.plugin');

const SignatorySchema = new mongoose.Schema({
  din: { type: String, trim: true, uppercase: true },
  fullName: { type: String, required: true, trim: true },
  designation: { type: String, required: true, trim: true },
  signedAt: { type: Date, default: null },
  dscTokenUsed: { type: String, trim: true, default: null },
}, { _id: false });

const statutoryDraftDocumentSchema = new mongoose.Schema({
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
  financialYear: {
    type: String,
    required: true,
    trim: true,
    index: true,
    // e.g. "2025-2026" or "2025-26"
  },
  documentType: {
    type: String,
    enum: [
      'BOARD_REPORT',
      'AOC_1',
      'AOC_2',
      'MGT_9',
      'AGM_NOTICE',
      'BOARD_RESOLUTION',
      'STATUTORY_REGISTER',
    ],
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  version: {
    type: Number,
    default: 1,
    min: 1,
  },
  status: {
    type: String,
    enum: ['DRAFT', 'UNDER_REVIEW', 'AWAITING_CLIENT_SIGN_OFF', 'APPROVED', 'REJECTED'],
    default: 'DRAFT',
    index: true,
  },
  caseId: {
    type: String,
    trim: true,
    default: null,
    index: true,
  },
  content: {
    type: String,
    required: true,
  },
  inputParameters: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({}),
  },
  signatories: [SignatorySchema],
  approvalRef: {
    approvalType: {
      type: String,
      enum: ['internal_partner', 'client', 'authorised_signatory', 'other'],
      default: null,
    },
    requestedAt: { type: Date, default: null },
    approverXID: { type: String, trim: true, default: null },
    approverEmail: { type: String, trim: true, default: null },
    decision: {
      type: String,
      enum: ['pending', 'approved', 'rejected', null],
      default: null,
    },
    decisionComment: { type: String, trim: true, default: '' },
    decidedAt: { type: Date, default: null },
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
  collection: 'statutoryDraftDocuments',
});

// Firm-scoped unique compound index per document type and FY
statutoryDraftDocumentSchema.index(
  { firmId: 1, cinOrLlpin: 1, documentType: 1, financialYear: 1, version: 1 },
  { unique: true, name: 'firm_statutory_draft_unique' }
);

statutoryDraftDocumentSchema.plugin(tenantScopeGuardPlugin);

module.exports = mongoose.model('StatutoryDraftDocument', statutoryDraftDocumentSchema);
