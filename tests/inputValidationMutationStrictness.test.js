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
  expectValid(adminSchemas['PATCH /clients/:clientId/status'].body, { isActive: true, verificationToken: 'token' }, 'admin client status');
  expectRejectUnknown(adminSchemas['PATCH /clients/:clientId/status'].body, { isActive: true, verificationToken: 'token', actorXID: 'X999999' }, 'admin client status');

  expectValid(adminSchemas['POST /clients/:clientId/change-name'].body, { legalName: 'Acme LLP' }, 'admin client rename');
  expectRejectUnknown(adminSchemas['POST /clients/:clientId/change-name'].body, { legalName: 'Acme LLP', updatedBy: 'bad' }, 'admin client rename');

  expectValid(adminSchemas['POST /cases/:id/restore'].body, {}, 'admin case restore');
  expectRejectUnknown(adminSchemas['POST /cases/:id/restore'].body, { firmId: 'override' }, 'admin case restore');

  expectValid(adminSchemas['POST /storage/disconnect'].body, {}, 'admin storage disconnect');
  expectRejectUnknown(adminSchemas['POST /storage/disconnect'].body, { rootFolderId: 'abc' }, 'admin storage disconnect');

  expectValid(
    adminSchemas['PUT /cms-intake-settings'].body,
    {
      autoCreateClient: true,
      autoCreateDocket: false,
      intakeApiEnabled: true,
      defaultCategoryId: null,
      defaultSubcategoryId: null,
      defaultWorkbasketId: null,
      defaultPriority: 'MEDIUM',
      defaultAssignee: null,
    },
    'admin cms intake settings update compatibility'
  );
  expectRejectUnknown(
    adminSchemas['PUT /cms-intake-settings'].body,
    { autoCreateClient: true, autoCreateDocket: true, intakeApiEnabled: true, tenantId: 'override' },
    'admin cms intake settings update'
  );

  expectValid(
    adminSchemas['PUT /firm-settings'].body,
    {
      firm: { slaDefaultDays: 3, enableBulkActions: true, brandLogoUrl: 'https://example.com/logo.png' },
      work: { assignmentStrategy: 'manual', autoAssignmentEnabled: false, dueSoonWarningDays: 2 },
    },
    'admin firm settings update compatibility'
  );
  expectRejectUnknown(
    adminSchemas['PUT /firm-settings'].body,
    { firm: { slaDefaultDays: 3, createdBy: 'attacker' } },
    'admin firm settings update'
  );

  expectValid(
    adminSchemas['PUT /storage'].body,
    { mode: 'firm_connected', provider: 'google_drive', google: { driveId: 'drive-1', rootFolderId: 'root-1' } },
    'admin storage update compatibility'
  );
  expectRejectUnknown(
    adminSchemas['PUT /storage'].body,
    { mode: 'firm_connected', provider: 'google_drive', privateKey: 'nope' },
    'admin storage update'
  );

  // Client strictness hardening
  expectValid(clientSchemas['POST /:clientId/fact-sheet/files'].body, {}, 'client fact-sheet files');
  expectRejectUnknown(clientSchemas['POST /:clientId/fact-sheet/files'].body, { createdBy: 'bad' }, 'client fact-sheet files');

  expectValid(clientSchemas['POST /:clientId/cfs/files'].body, {}, 'client cfs files');
  expectRejectUnknown(clientSchemas['POST /:clientId/cfs/files'].body, { actor: 'bad' }, 'client cfs files');

  expectValid(
    clientSchemas['PUT /:clientId/fact-sheet'].body,
    {
      description: 'Overview text',
      notes: 'Internal notes',
      basicInfo: { clientName: 'Acme', email: 'ops@acme.com', phone: '+91-9999999999' },
    },
    'client fact-sheet update compatibility'
  );
  expectRejectUnknown(
    clientSchemas['PUT /:clientId/fact-sheet'].body,
    { description: 'Overview text', actorXID: 'X999999' },
    'client fact-sheet update'
  );

  // Storage strictness hardening
  expectValid(storageSchemas['POST /google/confirm-drive'].body, { driveId: 'abc123' }, 'storage confirm-drive');
  expectRejectUnknown(storageSchemas['POST /google/confirm-drive'].body, { driveId: 'abc123', privateKey: 'nope' }, 'storage confirm-drive');

  expectValid(storageSchemas['POST /disconnect'].body, {}, 'storage disconnect');
  expectRejectUnknown(storageSchemas['POST /disconnect'].body, { token: 'unsafe' }, 'storage disconnect');

  // Query compatibility remains permissive for list/search/read flows in this phase.
  expectValid(clientSchemas['GET /:clientId/dockets'].query, { page: '1', limit: '20', q: 'tax' }, 'client dockets query');

  console.log('inputValidationMutationStrictness.test.js passed');
})();
