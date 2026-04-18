const WORK_TYPES = Object.freeze({
  CLIENT: 'client',
  INTERNAL: 'internal',
});

function normalizeIsInternal(value) {
  if (typeof value === 'boolean') return value;
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'true' || normalized === WORK_TYPES.INTERNAL || normalized === '1';
}

function normalizeWorkType(value, fallback = WORK_TYPES.CLIENT) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === WORK_TYPES.INTERNAL) return WORK_TYPES.INTERNAL;
  if (normalized === WORK_TYPES.CLIENT) return WORK_TYPES.CLIENT;
  return fallback;
}

function deriveWorkTypeFromIsInternal(isInternal) {
  return normalizeIsInternal(isInternal) ? WORK_TYPES.INTERNAL : WORK_TYPES.CLIENT;
}

function normalizeWorkMode({ isInternal, workType } = {}) {
  const hasIsInternal = typeof isInternal !== 'undefined';
  const normalizedIsInternal = hasIsInternal
    ? normalizeIsInternal(isInternal)
    : normalizeWorkType(workType, WORK_TYPES.CLIENT) === WORK_TYPES.INTERNAL;

  return {
    isInternal: normalizedIsInternal,
    workType: deriveWorkTypeFromIsInternal(normalizedIsInternal),
  };
}

function applyWorkModeFilter(query = {}, { isInternal, workType } = {}) {
  const next = { ...query };

  if (typeof isInternal !== 'undefined') {
    const normalized = normalizeIsInternal(isInternal);
    next.isInternal = normalized;
    next.workType = deriveWorkTypeFromIsInternal(normalized);
    return next;
  }

  if (typeof workType !== 'undefined' && String(workType).trim() !== '') {
    const normalized = normalizeWorkType(workType, WORK_TYPES.CLIENT);
    next.isInternal = normalized === WORK_TYPES.INTERNAL;
    next.workType = normalized;
  }

  return next;
}

module.exports = {
  WORK_TYPES,
  normalizeIsInternal,
  normalizeWorkType,
  deriveWorkTypeFromIsInternal,
  normalizeWorkMode,
  applyWorkModeFilter,
};
