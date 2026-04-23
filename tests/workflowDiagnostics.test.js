const assert = require('assert');
const { normalizeOperationalError, OPERATIONAL_ERROR_CODES } = require('../src/constants/operationalErrorCodes');
const { buildWorkflowMeta } = require('../src/utils/workflowDiagnostics');

(() => {
  const normalized = normalizeOperationalError({ code: OPERATIONAL_ERROR_CODES.UPLOAD_SESSION_EXPIRED, status: 410, message: 'expired' });
  assert.equal(normalized.code, 'UPLOAD_SESSION_EXPIRED');
  assert.equal(normalized.status, 410);
})();

(() => {
  const meta = buildWorkflowMeta({
    req: {
      user: { firmId: 'f1', xID: 'X123' },
      correlationId: 'corr-1',
      originalUrl: '/api/dockets/ABC',
      headers: { authorization: 'secret' },
    },
    workflow: 'docket_detail_load',
    entity: { caseId: 'D-1' },
    error: { code: 'UPLOAD_VERIFICATION_FAILED', message: 'nope', status: 400 },
  });

  assert.equal(meta.firmId, 'f1');
  assert.equal(meta.actorXID, 'X123');
  assert.equal(meta.correlationId, 'corr-1');
  assert.equal(meta.caseId, 'D-1');
  assert.ok(!('authorization' in meta));
})();

console.log('workflowDiagnostics tests passed');
