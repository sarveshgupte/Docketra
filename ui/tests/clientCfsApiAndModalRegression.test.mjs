import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const clientsPage = read('ui/src/pages/ClientsPage.jsx');
const clientApi = read('ui/src/api/client.api.js');

assert(clientsPage.includes('clientApi.getClientById(client.clientId)'), 'openEditCfsModal should fetch by selected client.clientId');
assert(clientApi.includes('http.get(`/clients/${clientId}`)'), 'clientApi.getClientById must call /clients/:clientId');
assert(clientApi.includes('http.put(`/clients/${clientId}/fact-sheet`'), 'updateClientFactSheet must call /clients/:clientId/fact-sheet');
assert(clientApi.includes('http.post(`/clients/${clientId}/cfs/files/upload-intent`'), 'upload intent should use /clients/:clientId/cfs/files/upload-intent');
assert(clientApi.includes('http.post(`/clients/${clientId}/cfs/files/finalize`'), 'finalize should use /clients/:clientId/cfs/files/finalize');
assert(clientApi.includes('http.delete(`/clients/${clientId}/cfs/files/${fileId}`)'), 'delete should use /clients/:clientId/cfs/files/:attachmentId');
assert(!clientApi.includes('/admin/clients'), 'client API should not use stale /admin/clients paths');

for (const expectedCopy of [
  'Client management access is required',
  'Client not found or no longer available',
  'Client record loaded, but some fact sheet resources are unavailable right now',
]) {
  assert(clientsPage.includes(expectedCopy), `Expected Edit CFS safe error copy: ${expectedCopy}`);
}

console.log('clientCfsApiAndModalRegression.test.mjs passed');
