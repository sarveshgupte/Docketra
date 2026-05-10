const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const clientController = read('src/controllers/client.controller.js');
const bulkUploadController = read('src/controllers/bulkUpload.controller.js');
const bulkSchema = read('ui/src/constants/bulkUploadSchema.js');
const clientRoutes = read('src/routes/client.routes.js');
const authzMiddleware = read('src/middleware/authorization.middleware.js');

for (const field of ['businessName', 'businessEmail', 'primaryContactNumber', 'businessAddress', 'PAN', 'CIN', 'TAN', 'GST', 'contactPersonName']) {
  assert.ok(clientController.includes(field), `client.controller must support field: ${field}`);
  assert.ok(bulkUploadController.includes(field), `bulkUpload.controller must support field: ${field}`);
  assert.ok(bulkSchema.includes(field), `bulk upload schema must support field: ${field}`);
}

assert.ok(clientRoutes.includes("authorizeFirmPermission('CLIENT_MANAGE')"), 'client write routes must require CLIENT_MANAGE permission');
assert.ok(authzMiddleware.includes('Client management access is required'), 'authorization middleware must use client-management denial copy');
assert.equal(authzMiddleware.includes('Admin access required'), false, 'stale Admin access copy must not remain in authorization middleware');

console.log('clientManagementFieldAlignment.test.js passed');
