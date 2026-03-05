const Case = require('../models/Case.model');

const findCaseById = async (caseId, firmId) => Case.findOne({ _id: caseId, firmId });

const countCases = async (firmId, query = {}) => Case.countDocuments({ firmId, ...query });

module.exports = {
  findCaseById,
  countCases,
};
