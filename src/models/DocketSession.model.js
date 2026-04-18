const mongoose = require('mongoose');

const docketSessionSchema = new mongoose.Schema({
  docketId: { type: String, required: true, index: true },
  firmId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },

  startedAt: { type: Date, required: true },
  lastHeartbeatAt: { type: Date, required: true },
  endedAt: { type: Date },

  activeSeconds: { type: Number, default: 0 },

  isActive: { type: Boolean, default: true },
}, { timestamps: true });

docketSessionSchema.index({ docketId: 1, firmId: 1, userId: 1, isActive: 1 });

docketSessionSchema.path('activeSeconds').set((value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 0;
  return Math.max(0, Math.round(numericValue));
});

module.exports = mongoose.model('DocketSession', docketSessionSchema);
