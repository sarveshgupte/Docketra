const mongoose = require('mongoose');
const Team = require('../models/Team.model');

const validateCategoryMappedWorkbasket = async ({ workbasketId, firmId }) => {
  if (!workbasketId || !mongoose.Types.ObjectId.isValid(workbasketId)) {
    return { valid: false, message: 'Valid active primary workbasket is required' };
  }

  const workbasket = await Team.findOne({
    _id: workbasketId,
    firmId,
    isActive: true,
    type: 'PRIMARY',
  }).select('_id type isActive firmId');

  if (!workbasket) {
    return { valid: false, message: 'Valid active primary workbasket is required' };
  }

  return { valid: true, workbasket };
};

module.exports = {
  validateCategoryMappedWorkbasket,
};
