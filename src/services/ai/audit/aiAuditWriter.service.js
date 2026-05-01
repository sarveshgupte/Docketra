const ALLOWED_FIELDS = new Set([
  'firmId',
  'userId',
  'feature',
  'provider',
  'model',
  'status',
  'reasonCode',
  'latencyMs',
  'inputTokens',
  'outputTokens',
  'totalTokens',
  'policyVersion',
  'redactionVersion',
  'timestamp',
]);

const FORBIDDEN_RAW_FIELDS = new Set([
  'prompt',
  'rawPrompt',
  'response',
  'rawResponse',
  'outputText',
  'inputText',
]);

function buildMetadataOnlyAuditRecord(event = {}) {
  for (const forbiddenField of FORBIDDEN_RAW_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(event, forbiddenField)) {
      throw new Error('RAW_AI_CONTENT_NOT_ALLOWED_IN_AUDIT');
    }
  }

  const record = {};
  for (const key of Object.keys(event)) {
    if (ALLOWED_FIELDS.has(key)) {
      record[key] = event[key];
    }
  }

  if (!record.timestamp) {
    record.timestamp = new Date().toISOString();
  }

  return record;
}

async function writeAiAuditEvent(event = {}) {
  const record = buildMetadataOnlyAuditRecord(event);
  return {
    persisted: false,
    record,
    reasonCode: 'AUDIT_PERSISTENCE_NOT_IMPLEMENTED',
  };
}

module.exports = {
  buildMetadataOnlyAuditRecord,
  writeAiAuditEvent,
};
