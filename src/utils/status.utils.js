const normalizeLifecycleStatus = (status) => {
  if (status === null || status === undefined) {
    return null;
  }

  const normalized = String(status).trim().toLowerCase();
  return normalized || null;
};

const isActiveStatus = (status) => normalizeLifecycleStatus(status) === 'active';

const getFirmInactiveCode = (status) => {
  const normalized = normalizeLifecycleStatus(status);
  if (normalized === 'suspended') return 'FIRM_SUSPENDED';
  if (normalized === 'inactive') return 'FIRM_INACTIVE';
  return 'FIRM_NOT_ACTIVE';
};

module.exports = {
  normalizeLifecycleStatus,
  isActiveStatus,
  getFirmInactiveCode,
};
