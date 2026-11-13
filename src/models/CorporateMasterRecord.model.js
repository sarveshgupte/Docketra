'use strict';

const mongoose = require('mongoose');
const { tenantScopeGuardPlugin } = require('./plugins/tenantScopeGuard.plugin');

const CorporateDirectorSchema = new mongoose.Schema({
  din: { type: String, trim: true, uppercase: true, index: true },
  fullName: { type: String, required: true, trim: true },
  designation: {
    type: String,
    enum: [
      'DIRECTOR',
      'MANAGING_DIRECTOR',
      'WHOLE_TIME_DIRECTOR',
      'INDEPENDENT_DIRECTOR',
      'DESIGNATED_PARTNER',
      'PARTNER',
      'NOMINEE_DIRECTOR',
      'ADDITIONAL_DIRECTOR',
      'OTHER',
    ],
    default: 'DIRECTOR',
  },
  appointmentDate: { type: Date, default: null },
  cessationDate: { type: Date, default: null },
  dir3KycStatus: {
    type: String,
    enum: ['FILED', 'PENDING', 'OVERDUE', 'EXEMPT', 'DEACTIVATED'],
    default: 'PENDING',
  },
  dir3KycDueDate: { type: Date, default: null },
  dscToken: {
    tokenId: { type: String, trim: true, default: null },
    holderName: { type: String, trim: true, default: null },
    certClass: { type: String, enum: ['CLASS_3'], default: 'CLASS_3' },
    validUntil: { type: Date, default: null },
    physicalLocation: { type: String, trim: true, default: null },
  },
}, { _id: true });

const CorporateChargeSchema = new mongoose.Schema({
  chargeId: { type: String, required: true, trim: true },
  holderName: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0 },
  creationDate: { type: Date, required: true },
  modificationDate: { type: Date, default: null },
  satisfactionDate: { type: Date, default: null },
  status: {
    type: String,
    enum: ['OPEN', 'MODIFIED', 'SATISFIED'],
    default: 'OPEN',
  },
  propertyDetails: { type: String, trim: true, default: '' },
}, { _id: true });

const CorporateFilingSchema = new mongoose.Schema({
  srn: { type: String, required: true, trim: true },
  formName: { type: String, required: true, trim: true },
  filingDate: { type: Date, required: true },
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'RESUBMISSION'],
    default: 'APPROVED',
  },
  amount: { type: Number, default: 0 },
}, { _id: true });

const corporateMasterRecordSchema = new mongoose.Schema({
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
  cinOrLlpin: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    index: true,
  },
  companyName: {
    type: String,
    required: true,
    trim: true,
  },
  companyClass: {
    type: String,
    enum: ['PRIVATE', 'PUBLIC', 'ONE_PERSON_COMPANY', 'LLP', 'FOREIGN', 'SECTION_8', 'OTHER'],
    default: 'PRIVATE',
  },
  companyCategory: {
    type: String,
    trim: true,
    default: 'Company limited by Shares',
  },
  roc: {
    type: String,
    trim: true,
    default: '',
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'STRIKE_OFF', 'UNDER_LIQUIDATION', 'AMALGAMATED', 'DISSOLVED', 'CONVERTED'],
    default: 'ACTIVE',
  },
  incorporationDate: {
    type: Date,
    default: null,
  },
  authorizedCapital: {
    type: Number,
    default: 0,
    min: 0,
  },
  paidUpCapital: {
    type: Number,
    default: 0,
    min: 0,
  },
  registeredOfficeAddress: {
    type: String,
    trim: true,
    default: '',
  },
  registeredEmail: {
    type: String,
    trim: true,
    default: '',
  },
  lastAgmDate: {
    type: Date,
    default: null,
  },
  lastBalanceSheetDate: {
    type: Date,
    default: null,
  },
  agmDueDate: {
    type: Date,
    default: null,
    index: true,
  },
  annualFilingDueDate: {
    type: Date,
    default: null,
  },
  directors: [CorporateDirectorSchema],
  charges: [CorporateChargeSchema],
  filings: [CorporateFilingSchema],
  lastSyncedAt: {
    type: Date,
    default: Date.now,
  },
  syncStatus: {
    type: String,
    enum: ['SUCCESS', 'PENDING', 'FAILED', 'STALE'],
    default: 'SUCCESS',
  },
  syncError: {
    type: String,
    default: null,
  },
  syncSource: {
    type: String,
    enum: ['DATA_GOV_OPEN_DATA', 'PUBLIC_REGISTRY_MIRROR', 'AUTHENTICATED_SESSION', 'MOCK_FIXTURE'],
    default: 'PUBLIC_REGISTRY_MIRROR',
  },
}, {
  timestamps: true,
  collection: 'corporateMasterRecords',
});

// Firm-scoped unique index per CIN / LLPIN
corporateMasterRecordSchema.index(
  { firmId: 1, cinOrLlpin: 1 },
  { unique: true, name: 'firm_cin_unique' }
);

corporateMasterRecordSchema.index(
  { firmId: 1, clientId: 1 },
  { sparse: true, name: 'firm_client_idx' }
);

corporateMasterRecordSchema.plugin(tenantScopeGuardPlugin);

module.exports = mongoose.model('CorporateMasterRecord', corporateMasterRecordSchema);
