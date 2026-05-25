const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const schemaSource = read('src/schemas/worklist.routes.schema.js');
assert.ok(schemaSource.includes('workbasketId: nonEmptyString.optional()'), 'employee worklist schema should accept workbasketId');

const controllerSource = read('src/controllers/search.controller.js');
assert.ok(controllerSource.includes("if (!workbasketIdFilter)"), 'invalid workbasket ids should be rejected');
assert.ok(controllerSource.includes("return res.status(404).json({ success: false, message: 'Workbasket not found' });"), 'unknown or cross-firm workbasket should be hidden via 404');
assert.ok(controllerSource.includes("const isAdminViewer = viewerRole === 'ADMIN' || viewerRole === 'PRIMARY_ADMIN';"), 'admin/primary admin bypass should be explicit');
assert.ok(controllerSource.includes('parentWorkbasketId'), 'membership check should use linked workbasket relationships for QC/primary');
assert.ok(controllerSource.includes('workbasketId: scopedWorkbasketId'), 'worklist filter should scope by authorized workbasket id');
assert.ok(controllerSource.includes('ownerTeamId: scopedWorkbasketId'), 'worklist filter should include ownerTeamId for backwards compatibility');
assert.ok(controllerSource.includes('routedToTeamId: scopedWorkbasketId'), 'worklist filter should include routedToTeamId for backwards compatibility');

console.log('worklistScopedAuthorizationRegression.test.js passed');
