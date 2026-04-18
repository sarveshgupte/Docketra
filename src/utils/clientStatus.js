const CANONICAL_CLIENT_STATUSES = Object.freeze({
  LEAD: 'lead',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
});

const LEGACY_TO_CANONICAL = Object.freeze({
  LEAD: CANONICAL_CLIENT_STATUSES.LEAD,
  lead: CANONICAL_CLIENT_STATUSES.LEAD,
  ACTIVE: CANONICAL_CLIENT_STATUSES.ACTIVE,
  active: CANONICAL_CLIENT_STATUSES.ACTIVE,
  INACTIVE: CANONICAL_CLIENT_STATUSES.INACTIVE,
  inactive: CANONICAL_CLIENT_STATUSES.INACTIVE,
});

const ACTIVE_STATUS_VALUES = Object.freeze(['active', 'ACTIVE']);
const INACTIVE_STATUS_VALUES = Object.freeze(['inactive', 'INACTIVE']);
const LEAD_STATUS_VALUES = Object.freeze(['lead', 'LEAD']);

function normalizeClientStatus(status, fallback = CANONICAL_CLIENT_STATUSES.ACTIVE) {
  const raw = String(status || '').trim();
  return LEGACY_TO_CANONICAL[raw] || fallback;
}

function buildClientStatusQuery(status) {
  const normalized = normalizeClientStatus(status);
  if (normalized === CANONICAL_CLIENT_STATUSES.ACTIVE) {
    return { $in: ACTIVE_STATUS_VALUES };
  }
  if (normalized === CANONICAL_CLIENT_STATUSES.INACTIVE) {
    return { $in: INACTIVE_STATUS_VALUES };
  }
  return { $in: LEAD_STATUS_VALUES };
}

function isClientActive(status) {
  return normalizeClientStatus(status) === CANONICAL_CLIENT_STATUSES.ACTIVE;
}

module.exports = {
  CANONICAL_CLIENT_STATUSES,
  normalizeClientStatus,
  buildClientStatusQuery,
  isClientActive,
};
