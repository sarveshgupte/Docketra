const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Team name is required'],
    trim: true,
  },
  firmId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Firm',
    required: [true, 'Firm is required'],
    index: true,
  },

  managerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  },

  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

teamSchema.index({ firmId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Team', teamSchema);
