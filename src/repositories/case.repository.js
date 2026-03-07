const CaseRepository = require('./CaseRepository');

module.exports = {
  ...CaseRepository,
  findCaseById: (caseId, firmId, role = 'Admin') => CaseRepository.findById(firmId, caseId, role),
  countCases: (firmId, query = {}) => CaseRepository.count(firmId, query),
};
