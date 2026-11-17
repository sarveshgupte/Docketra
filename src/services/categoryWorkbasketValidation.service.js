const mongoose = require('mongoose');
const Team = require('../models/Team.model');

const validateCategoryMappedWorkbasket = async ({ workbasketId, firmId }) => {
  if (!workbasketId || !mongoose.Types.ObjectId.isValid(workbasketId)) {
    return { valid: false, message: 'Valid active primary workbasket is required' };
  }

  const query = {
    _id: workbasketId,
    isActive: true,
    type: 'PRIMARY',
  };
  if (firmId) {
    query.firmId = firmId;
  }

  let workbasket = await Team.findOne(query).select('_id type isActive firmId');

  // Resilient fallback for unmigrated / legacy workbaskets where type may be null or undefined
  if (!workbasket) {
    const fallbackQuery = {
      _id: workbasketId,
      isActive: { $ne: false },
      $or: [
        { type: 'PRIMARY' },
        { type: { $ne: 'QC' } },
        { type: { $exists: false } },
        { type: null },
      ],
    };
    if (firmId) {
      fallbackQuery.firmId = firmId;
    }

    const fallbackWorkbasket = await Team.findOne(fallbackQuery).select('_id type isActive firmId');
    if (fallbackWorkbasket) {
      if (fallbackWorkbasket.type !== 'PRIMARY') {
        await Team.updateOne({ _id: fallbackWorkbasket._id }, { $set: { type: 'PRIMARY' } }).catch(() => {});
      }
      workbasket = fallbackWorkbasket;
    }
  }

  if (!workbasket) {
    return { valid: false, message: 'Valid active primary workbasket is required' };
  }

  return { valid: true, workbasket };
};

module.exports = {
  validateCategoryMappedWorkbasket,
};
