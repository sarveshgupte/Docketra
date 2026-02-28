const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  maxUsers: { type: Number, default: null },
  billingType: {
    type: String,
    enum: ['FREE', 'PER_USER', 'ENTERPRISE'],
    required: true,
  },
  pricePerUser: { type: Number, default: null },
  isEnterprise: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Plan', planSchema);
