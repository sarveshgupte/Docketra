import { CASE_CATEGORIES } from './constants';

const sanitize = (value) => String(value || '').trim();
const toLookupKey = (value) => sanitize(value).toLowerCase();

const categoryValues = Object.values(CASE_CATEGORIES);

export const WORK_TYPE_OPTIONS = categoryValues.map((value) => ({
  value,
  label: value,
}));

const WORK_TYPE_LOOKUP = new Map(
  WORK_TYPE_OPTIONS.map((option) => [toLookupKey(option.value), option.value]),
);

export const normalizeWorkType = (value) => {
  const trimmed = sanitize(value);
  if (!trimmed) return '';
  return WORK_TYPE_LOOKUP.get(toLookupKey(trimmed)) || trimmed;
};

export const getWorkTypeLabel = (value) => {
  const normalized = normalizeWorkType(value);
  if (!normalized) return '';
  return WORK_TYPE_LOOKUP.has(toLookupKey(normalized)) ? normalized : `Custom: ${normalized}`;
};

export const isKnownWorkType = (value) => {
  const trimmed = sanitize(value);
  if (!trimmed) return false;
  return WORK_TYPE_LOOKUP.has(toLookupKey(trimmed));
};
