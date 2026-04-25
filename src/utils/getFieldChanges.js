const { sanitizeForAudit } = require('./redaction');

const isPlainObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

const sanitizeValue = (value, key = '') => sanitizeForAudit(value, key);

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
