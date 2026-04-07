const mongoose = require('mongoose');

const bulkUploadJobSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['clients', 'categories', 'team'],
    index: true,
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
    index: true,
  },
  total: {
    type: Number,
    required: true,
    default: 0,
  },
  processed: {
    type: Number,
    required: true,
    default: 0,
  },
  successCount: {
    type: Number,
    required: true,
    default: 0,
  },
  failureCount: {
    type: Number,
    required: true,
    default: 0,
  },
  results: {
    type: [mongoose.Schema.Types.Mixed],
    default: [],
  },
  duplicateMode: {
    type: String,
    enum: ['skip', 'update', 'fail'],
    default: 'skip',
  },
  createdBy: {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    firmId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    email: { type: String, default: null },
    xID: { type: String, default: null },
  },
  errorMessage: {
    type: String,
    default: null,
  },
}, {
  strict: true,
  timestamps: true,
});

bulkUploadJobSchema.index({ 'createdBy.firmId': 1, createdAt: -1 });

module.exports = mongoose.model('BulkUploadJob', bulkUploadJobSchema);
