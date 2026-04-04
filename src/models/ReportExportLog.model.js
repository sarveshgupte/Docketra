const mongoose = require('mongoose');

const reportExportLogSchema = new mongoose.Schema({
  firmId: {
    type: String,
    required: true,
    index: true,
  },
  exportedByXID: {
    type: String,
    required: true,
    index: true,
  },
  exportedByName: {
    type: String,
    default: null,
  },
  exportedByEmail: {
    type: String,
    default: null,
  },
  exportType: {
    type: String,
    enum: ['csv', 'excel'],
    required: true,
    index: true,
  },
  filename: {
    type: String,
    required: true,
  },
  filters: {
    type: Object,
    default: {},
  },
  totalRecords: {
    type: Number,
    default: 0,
    min: 0,
  },
  exportedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, {
  versionKey: false,
});

reportExportLogSchema.index({ firmId: 1, exportedAt: -1 });

module.exports = mongoose.model('ReportExportLog', reportExportLogSchema);
