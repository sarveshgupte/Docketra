'use strict';

const PROHIBITED_KEYS = new Set([
  'notes', 'comments', 'description', 'remarks', 'instructions', 'content',
  'businessname', 'businessemail', 'primarycontactnumber', 'address',
  'pan', 'gst', 'tan', 'cin', 'clientfactsheet', 'checklist', 'sop',
  'documenttext', 'attachmentcontent', 'filebuffer', 'rawpayload',
]);

function flattenKeys(input, prefix = '', keys = []) {
  if (!input || typeof input !== 'object') return keys;
  Object.entries(input).forEach(([key, value]) => {
    const normalized = String(key).replace(/\$/g, '').toLowerCase();
    keys.push(normalized);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      flattenKeys(value, `${prefix}${key}.`, keys);
    }
  });
  return keys;
}

function assertNoProhibitedMongoBusinessContent(payload = {}, { context = 'mongo_write' } = {}) {
  const keys = flattenKeys(payload);
  const hit = keys.find((k) => PROHIBITED_KEYS.has(k));
  if (!hit) return;
  const err = new Error(`BYOS_MONGO_WRITE_BLOCKED:${hit}`);
  err.code = 'BYOS_MONGO_WRITE_BLOCKED';
  err.statusCode = 400;
  err.context = context;
  throw err;
}

module.exports = {
  assertNoProhibitedMongoBusinessContent,
};
