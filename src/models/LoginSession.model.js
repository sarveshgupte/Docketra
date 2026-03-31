const mongoose = require('mongoose');

const loginSessionSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  firmId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  xID: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  consumedAt: { type: Date, default: null, index: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('LoginSession', loginSessionSchema);
