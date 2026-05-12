const assert = require('node:assert/strict');

const clientSchemas = require('../src/schemas/client.routes.schema');
const { clientIdString } = require('../src/schemas/common');

assert.doesNotThrow(() => clientIdString.parse('C000001'), 'clientIdString must accept generated client ids like C000001');
assert.doesNotThrow(() => clientIdString.parse('c000001'), 'clientIdString should be case-insensitive');

for (const route of [
  'GET /:clientId',
  'PUT /:clientId/fact-sheet',
  'POST /:clientId/fact-sheet/files',
  'DELETE /:clientId/fact-sheet/files/:fileId',
  'POST /:clientId/cfs/files/upload-intent',
  'POST /:clientId/cfs/files/finalize',
  'POST /:clientId/cfs/files',
  'DELETE /:clientId/cfs/files/:attachmentId',
  'GET /:clientId/cfs/files',
  'GET /:clientId/cfs/files/:attachmentId/download',
  'GET /:clientId/cfs/comments',
  'POST /:clientId/cfs/comments',
]) {
  assert(clientSchemas[route], `Missing schema for route: ${route}`);
}

console.log('clientCfsRouteSchemaAlignment.test.js passed');
