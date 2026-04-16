const SENSITIVE_KEY_PATTERN = /(password|token|secret|credential|authorization|cookie|otp|refresh|access|api[-_]?key)/i;

const isPlainObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

const sanitizeValue = (value, key = '') => {
  if (SENSITIVE_KEY_PATTERN.test(String(key || ''))) return '[REDACTED]';
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item));
  if (isPlainObject(value)) {
    const sanitized = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      sanitized[childKey] = sanitizeValue(childValue, childKey);
    }
    return sanitized;
  }
  return value;
};

const getFieldChanges = (oldDoc = {}, newDoc = {}) => {
  const previous = isPlainObject(oldDoc) ? oldDoc : {};
  const current = isPlainObject(newDoc) ? newDoc : {};
  const keys = new Set([...Object.keys(previous), ...Object.keys(current)]);
  const changes = [];

  for (const key of keys) {
    const oldValue = sanitizeValue(previous[key], key);
    const newValue = sanitizeValue(current[key], key);
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changes.push({
        field: key,
        oldValue: oldValue === undefined ? null : oldValue,
        newValue: newValue === undefined ? null : newValue,
      });
    }
  }

  return changes;
};

module.exports = {
  getFieldChanges,
  sanitizeValue,
};
