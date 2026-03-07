const UserRepository = require('./UserRepository');

module.exports = {
  ...UserRepository,
  findUserById: (userId, firmId) => UserRepository.findById(firmId, userId),
  countUsers: (firmId, query = {}) => UserRepository.count(firmId, query),
};
