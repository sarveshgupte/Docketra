const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  firmId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Firm',
    required: [true, 'Firm is required'],
    index: true,
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CrmClient',
    required: [true, 'Client is required'],
    index: true,
  },
  dealId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Deal',
    default: null,
    index: true,
  },
  docketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case',
    default: null,
    index: true,
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
  },
  status: {
    type: String,
    enum: ['unpaid', 'paid'],
    default: 'unpaid',
    index: true,
  },
  issuedAt: {
    type: Date,
    default: () => new Date(),
  },
  paidAt: {
    type: Date,
    default: null,
  },
}, { timestamps: { createdAt: true, updatedAt: false } });

invoiceSchema.index({ firmId: 1, createdAt: -1 });
invoiceSchema.index({ firmId: 1, status: 1 });

module.exports = mongoose.model('Invoice', invoiceSchema);
