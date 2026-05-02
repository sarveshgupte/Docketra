const mongoose = require('mongoose');

const featureFlagStateSchema = new mongoose.Schema({
  enabledGlobally: { type: Boolean, default: false },
  rolloutStage: { type: String, enum: ['off', 'internal', 'pilot', 'beta', 'general'], default: 'off' },
  updatedAt: { type: Date, default: Date.now },
}, { _id: false });

const superadminPlatformConfigSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, index: true },
  featureFlags: { type: Map, of: featureFlagStateSchema, default: {} },
}, { timestamps: true, strict: true });

module.exports = mongoose.model('SuperadminPlatformConfig', superadminPlatformConfigSchema);
