import assert from 'node:assert/strict';

import { getCaseListRecords } from '../ui/src/utils/caseResponse.js';
import { resolveFirmLoginPath } from '../ui/src/utils/tenantRouting.js';

assert.equal(
  resolveFirmLoginPath({
    firmSlug: 'gupte-opc',
  }),
  '/gupte-opc/login',
  'tenant app routes should redirect to the firm-scoped login route',
);

assert.equal(
  resolveFirmLoginPath({
    fallbackFirmSlug: 'gupte-opc',
  }),
  '/gupte-opc/login',
  'non-app routes should use the existing public firm login route',
);

assert.deepEqual(
  getCaseListRecords({ data: [{ caseId: 'CASE-1' }] }),
  [{ caseId: 'CASE-1' }],
  'case lists should support the existing data payload shape',
);

assert.deepEqual(
  getCaseListRecords({ cases: [{ caseId: 'CASE-2' }] }),
  [{ caseId: 'CASE-2' }],
  'case lists should support the new cases payload alias',
);

assert.deepEqual(
  getCaseListRecords({ data: null, cases: undefined }),
  [],
  'case lists should default missing payloads to an empty array',
);

console.log('tenant routing and case response helpers passed');
