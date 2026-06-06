const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const clientController = read('src/controllers/client.controller.js');
const bulkUploadController = read('src/controllers/bulkUpload.controller.js');
const bulkSchema = read('ui/src/constants/bulkUploadSchema.js');
const clientRoutes = read('src/routes/client.routes.js');
const clientRouteSchema = read('src/schemas/client.routes.schema.js');
const authzMiddleware = read('src/middleware/authorization.middleware.js');
const permissionMiddleware = read('src/middleware/permission.middleware.js');

for (const field of ['businessName', 'businessEmail', 'primaryContactNumber', 'businessAddress', 'PAN', 'CIN', 'TAN', 'GST', 'contactPersonName']) {
  assert.ok(clientController.includes(field), `client.controller must support field: ${field}`);
  assert.ok(bulkUploadController.includes(field), `bulkUpload.controller must support field: ${field}`);
  assert.ok(bulkSchema.includes(field), `bulk upload schema must support field: ${field}`);
  assert.ok(clientRouteSchema.includes(field), `client route schema must support field: ${field}`);
}

assert.ok(clientRouteSchema.includes("'POST /'"), 'client route schema must define POST / validation');

assert.ok(clientRoutes.includes("authorizeFirmPermission('CLIENT_MANAGE')"), 'client write routes must require CLIENT_MANAGE permission');
assert.ok(authzMiddleware.includes('Admin access required'), 'generic admin middleware must keep admin denial copy');
assert.equal(authzMiddleware.includes('Client management requires Admin access'), false, 'generic admin middleware must not use client-management denial copy');
assert.ok(permissionMiddleware.includes("requiredPermission === 'CLIENT_MANAGE'"), 'permission middleware must special-case CLIENT_MANAGE denial copy');
assert.ok(permissionMiddleware.includes('Client management requires Admin access'), 'client-management denial copy must be emitted by permission middleware');

console.log('clientManagementFieldAlignment.test.js passed');
