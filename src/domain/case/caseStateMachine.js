const CaseStatus = require('./caseStatus');

const transitions = {
  [CaseStatus.OPEN]: [
    CaseStatus.PENDED,
    CaseStatus.FILED,
    CaseStatus.RESOLVED,
  ],
  [CaseStatus.PENDED]: [
    CaseStatus.OPEN,
    CaseStatus.FILED,
  ],
  [CaseStatus.FILED]: [
    CaseStatus.RESOLVED,
  ],
  [CaseStatus.RESOLVED]: [],
};

function canTransition(from, to) {
  if (!transitions[from]) return false;
  return transitions[from].includes(to);
}

module.exports = {
  transitions,
  canTransition,
};
