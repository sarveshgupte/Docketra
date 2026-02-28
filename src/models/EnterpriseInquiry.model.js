const mongoose = require('mongoose');

const enterpriseInquirySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  firmName: { type: String, required: true, trim: true },
  numberOfUsers: { type: Number, required: true, min: 1 },
  phone: { type: String, required: true, trim: true },
  requirements: { type: String, required: true, trim: true },
}, { timestamps: true });

module.exports = mongoose.model('EnterpriseInquiry', enterpriseInquirySchema);
