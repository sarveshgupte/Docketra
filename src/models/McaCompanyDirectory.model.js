'use strict';

const mongoose = require('mongoose');

const mcaCompanyDirectorySchema = new mongoose.Schema(
  {
    cin: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    companyName: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    companyClass: {
      type: String,
      enum: ['PRIVATE', 'PUBLIC', 'ONE_PERSON_COMPANY', 'OTHER'],
      default: 'PRIVATE',
      index: true,
    },
    companyCategory: {
      type: String,
      trim: true,
      default: 'Company limited by shares',
    },
    companySubCategory: {
      type: String,
      trim: true,
      default: 'Non-government company',
    },
    roc: {
      type: String,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'STRIKE_OFF', 'UNDER_LIQUIDATION', 'AMALGAMATED', 'DORMANT', 'CONVERTED_TO_LLP', 'OTHER'],
      default: 'ACTIVE',
      index: true,
    },
    incorporationDate: {
      type: Date,
    },
    authorizedCapital: {
      type: Number,
      default: 0,
    },
    paidUpCapital: {
      type: Number,
      default: 0,
    },
    registeredOfficeAddress: {
      type: String,
      trim: true,
      default: '',
    },
    registeredEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    state: {
      type: String,
      trim: true,
      index: true,
    },
    pinCode: {
      type: String,
      trim: true,
    },
    syncSource: {
      type: String,
      default: 'DATA_GOV_OPEN_DATA',
    },
    syncedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Search indexes for rapid typeahead autocomplete and full-text search
mcaCompanyDirectorySchema.index({ companyName: 'text', cin: 'text' });
mcaCompanyDirectorySchema.index({ status: 1, companyName: 1 });

const McaCompanyDirectory = mongoose.models.McaCompanyDirectory || mongoose.model('McaCompanyDirectory', mcaCompanyDirectorySchema);

module.exports = McaCompanyDirectory;
