const Client = require('../models/Client.model');

const findClientById = async (clientId, firmId) => Client.findOne({ clientId, firmId });

const countClients = async (firmId, query = {}) => Client.countDocuments({ firmId, ...query });

module.exports = {
  findClientById,
  countClients,
};
