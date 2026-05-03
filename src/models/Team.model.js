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

  type: {
    type: String,
    enum: ['PRIMARY', 'QC'],
    default: 'PRIMARY',
    index: true,
  },

  parentWorkbasketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    default: null,
    index: true,
  },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

teamSchema.index({ firmId: 1, name: 1 }, { unique: true });
teamSchema.index(
  { firmId: 1, parentWorkbasketId: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: {
      type: 'QC',
      parentWorkbasketId: { $type: 'objectId' },
    },
  },
);

teamSchema.pre('validate', async function enforceWorkbasketGuardrails(next) {
  if (this.type === 'QC' && !this.parentWorkbasketId) {
    return next(new Error('QC workbasket must reference a parent PRIMARY workbasket'));
  }
  if (this.type === 'PRIMARY') {
    this.parentWorkbasketId = null;
  }
  if (this.type === 'QC' && this.parentWorkbasketId) {
    const Team = mongoose.model('Team');
    const parent = await Team.findOne({ _id: this.parentWorkbasketId }).select('_id firmId type').lean();
    if (!parent) return next(new Error('QC workbasket parent must exist'));
    if (String(parent.type) !== 'PRIMARY') return next(new Error('QC workbasket parent must be a PRIMARY workbasket'));
    if (String(parent.firmId) !== String(this.firmId)) return next(new Error('QC workbasket parent must belong to same firm'));
  }
  return next();
});

module.exports = mongoose.model('Team', teamSchema);
