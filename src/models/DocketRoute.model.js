const mongoose = require('mongoose');

const docketRouteSchema = new mongoose.Schema({
  docketId: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  fromTeamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true,
    index: true,
  },
  toTeamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true,
    index: true,
  },
  routedBy: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
  },
  routedAt: {
    type: Date,
    required: true,
    default: Date.now,
  },
  returnedAt: {
    type: Date,
    default: null,
  },
  note: {
    type: String,
    trim: true,
    default: null,
  },
  firmId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Firm',
    required: true,
    index: true,
  },
}, { timestamps: true });

module.exports = mongoose.model('DocketRoute', docketRouteSchema);
