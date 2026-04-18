const CANONICAL_DOCKET_STATES = Object.freeze([
  'IN_WB',
  'IN_PROGRESS',
  'IN_QC',
  'PENDED',
  'RESOLVED',
  'FILED',
]);

const TERMINAL_STATUS_MAP = Object.freeze({
  RESOLVED: 'RESOLVED',
  FILED: 'FILED',
});

function normalize(value) {
  return String(value || '').trim().toUpperCase();
}

function getCanonicalDocketState(docket = {}) {
  const explicit = normalize(docket.state);
  if (CANONICAL_DOCKET_STATES.includes(explicit)) {
    return explicit;
  }

  const status = normalize(docket.status);
  if (TERMINAL_STATUS_MAP[status]) {
    return TERMINAL_STATUS_MAP[status];
  }

  if (['QC_PENDING'].includes(status)) {
    return 'IN_QC';
  }

  if (status === 'PENDING') {
    return 'PENDED';
  }

  if (['ASSIGNED', 'IN_PROGRESS', 'QC_FAILED', 'QC_CORRECTED'].includes(status)) {
    return 'IN_PROGRESS';
  }

  if (status === 'OPEN') {
    return docket.assignedToXID ? 'IN_PROGRESS' : 'IN_WB';
  }

  const assignedToXID = String(docket.assignedToXID || '').trim();
  if (assignedToXID) {
    return 'IN_PROGRESS';
  }

  const queueType = normalize(docket.queueType);
  if (queueType === 'PERSONAL') {
    return 'IN_PROGRESS';
  }

  return 'IN_WB';
}

module.exports = {
  CANONICAL_DOCKET_STATES,
  getCanonicalDocketState,
};
