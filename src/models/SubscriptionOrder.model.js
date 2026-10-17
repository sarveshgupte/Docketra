const mongoose = require('mongoose');

const subscriptionOrderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true,
  },
  firmId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Firm',
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  plan: {
    type: String,
    enum: ['starter', 'growth', 'pro'],
    required: true,
    lowercase: true,
  },
  billingCycle: {
    type: String,
    enum: ['monthly', 'annual'],
    required: true,
    lowercase: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 1,
  },
  currency: {
    type: String,
    default: 'INR',
    uppercase: true,
  },
  payeeVpa: {
    type: String,
    required: true,
    trim: true,
  },
  payeeName: {
    type: String,
    required: true,
    trim: true,
  },
  upiUri: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['PENDING', 'VERIFYING', 'COMPLETED', 'FAILED', 'EXPIRED'],
    default: 'PENDING',
    index: true,
  },
  utr: {
    type: String,
    default: null,
    trim: true,
    uppercase: true,
  },
  paidAt: {
    type: Date,
    default: null,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true,
  },
  verifiedVia: {
    type: String,
    enum: ['UTR_SUBMISSION', 'YOUPI_WEBHOOK', 'SUPERADMIN_MANUAL'],
    default: null,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, { timestamps: true });

// Prevent duplicate UTR assignments across completed orders
subscriptionOrderSchema.index({ utr: 1, status: 1 });

module.exports = mongoose.model('SubscriptionOrder', subscriptionOrderSchema);
