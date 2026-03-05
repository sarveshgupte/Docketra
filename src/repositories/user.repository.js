const User = require('../models/User.model');

const findUserById = async (userId, firmId) => User.findOne({ _id: userId, firmId });

const countUsers = async (firmId, query = {}) => User.countDocuments({ firmId, ...query });

module.exports = {
  findUserById,
  countUsers,
};
