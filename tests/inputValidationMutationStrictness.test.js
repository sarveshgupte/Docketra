#!/usr/bin/env node
const assert = require('assert');

const adminSchemas = require('../src/schemas/admin.routes.schema');
const clientSchemas = require('../src/schemas/client.routes.schema');
const storageSchemas = require('../src/schemas/storage.routes.schema');

function expectValid(schema, payload, label) {
  const result = schema.safeParse(payload);
  assert.strictEqual(result.success, true, `${label} expected valid payload`);
}

function expectRejectUnknown(schema, payload, label) {
  const result = schema.safeParse(payload);
  assert.strictEqual(result.success, false, `${label} expected unknown-key rejection`);
}

(function run() {
  // Admin strictness hardening
  expectValid(adminSchemas['PATCH /clients/:clientId/status'].body, { status: 'ACTIVE' }, 'admin client status');
  expectRejectUnknown(adminSchemas['PATCH /clients/:clientId/status'].body, { status: 'ACTIVE', actorXID: 'X999999' }, 'admin client status');

  expectValid(adminSchemas['POST /clients/:clientId/change-name'].body, { legalName: 'Acme LLP' }, 'admin client rename');
  expectRejectUnknown(adminSchemas['POST /clients/:clientId/change-name'].body, { legalName: 'Acme LLP', updatedBy: 'bad' }, 'admin client rename');

  expectValid(adminSchemas['POST /cases/:id/restore'].body, {}, 'admin case restore');
  expectRejectUnknown(adminSchemas['POST /cases/:id/restore'].body, { firmId: 'override' }, 'admin case restore');

  expectValid(adminSchemas['POST /storage/disconnect'].body, {}, 'admin storage disconnect');
  expectRejectUnknown(adminSchemas['POST /storage/disconnect'].body, { rootFolderId: 'abc' }, 'admin storage disconnect');

  // Client strictness hardening
  expectValid(clientSchemas['POST /:clientId/fact-sheet/files'].body, {}, 'client fact-sheet files');
  expectRejectUnknown(clientSchemas['POST /:clientId/fact-sheet/files'].body, { createdBy: 'bad' }, 'client fact-sheet files');

  expectValid(clientSchemas['POST /:clientId/cfs/files'].body, {}, 'client cfs files');
  expectRejectUnknown(clientSchemas['POST /:clientId/cfs/files'].body, { actor: 'bad' }, 'client cfs files');

  // Storage strictness hardening
  expectValid(storageSchemas['POST /google/confirm-drive'].body, { driveId: 'abc123' }, 'storage confirm-drive');
  expectRejectUnknown(storageSchemas['POST /google/confirm-drive'].body, { driveId: 'abc123', privateKey: 'nope' }, 'storage confirm-drive');

  expectValid(storageSchemas['POST /disconnect'].body, {}, 'storage disconnect');
  expectRejectUnknown(storageSchemas['POST /disconnect'].body, { token: 'unsafe' }, 'storage disconnect');

  // Query compatibility remains permissive for list/search/read flows in this phase.
  expectValid(clientSchemas['GET /:clientId/dockets'].query, { page: '1', limit: '20', q: 'tax' }, 'client dockets query');

  console.log('inputValidationMutationStrictness.test.js passed');
})();
