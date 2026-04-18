export const WORK_TYPE = Object.freeze({
  ALL: 'ALL',
  CLIENT: 'client',
  INTERNAL: 'internal',
});

export const normalizeWorkTypeFilter = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === WORK_TYPE.INTERNAL) return WORK_TYPE.INTERNAL;
  if (normalized === WORK_TYPE.CLIENT) return WORK_TYPE.CLIENT;
  return WORK_TYPE.ALL;
};

export const getWorkTypeLabel = (value) => {
  const normalized = normalizeWorkTypeFilter(value);
  if (normalized === WORK_TYPE.INTERNAL) return 'Internal Work';
  if (normalized === WORK_TYPE.CLIENT) return 'Client Work';
  return 'All Work';
};
