import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const clientsPage = read('ui/src/pages/ClientsPage.jsx');
const clientApi = read('ui/src/api/client.api.js');
const protectedRoute = read('ui/src/components/auth/ProtectedRoute.jsx');
const protectedRoutes = read('ui/src/routes/ProtectedRoutes.jsx');
const bulkSchema = read('ui/src/constants/bulkUploadSchema.js');

for (const field of ['businessName','businessEmail','primaryContactNumber','businessAddress','PAN','CIN','TAN','GST','contactPersonName']) {
  assert(clientsPage.includes(field), `Clients modal should include ${field}`);
  assert(bulkSchema.includes(`key: '${field}'`), `Bulk schema should include ${field}`);
}

assert(clientsPage.includes('const name = clientForm.businessName.trim();'), 'businessName should be validated as required');
assert(!clientApi.includes('/admin/clients'), 'Client API must not use stale /admin/clients');
assert(clientApi.includes("http.post('/clients', clientData)"), 'Create must use /clients');
assert(clientApi.includes('http.put(`/clients/${clientId}`, clientData)'), 'Update must use /clients/:clientId');
assert(protectedRoutes.includes('<ProtectedRoute requireClientManage>'), 'Clients route should enforce client-manage guard');
assert(protectedRoute.includes('Client management requires Admin access.'), 'Guard copy should be client-management specific');
assert(protectedRoute.includes('Admin access is required to view that page.'), 'Generic admin guard copy should remain admin-specific');
assert(!clientsPage.includes('Admin access required'), 'Clients page should not contain stale admin-only denial copy');

console.log('clientManagementRegression.audit.test.mjs passed');
