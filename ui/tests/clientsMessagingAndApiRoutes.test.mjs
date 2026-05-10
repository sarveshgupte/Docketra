import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const clientsPage = fs.readFileSync(path.join(root, 'ui', 'src', 'pages', 'ClientsPage.jsx'), 'utf8');
const protectedRoute = fs.readFileSync(path.join(root, 'ui', 'src', 'components', 'auth', 'ProtectedRoute.jsx'), 'utf8');
const clientApi = fs.readFileSync(path.join(root, 'ui', 'src', 'api', 'client.api.js'), 'utf8');

assert(!clientsPage.includes('Admin access required'), 'ClientsPage should not contain stale admin-only error copy');
assert(protectedRoute.includes('canManageClients(user)'), 'ProtectedRoute requireClientManage must use canManageClients(user)');
assert(protectedRoute.includes('Client management access is required to view that page.'), 'ProtectedRoute should show client management capability copy');
assert(clientApi.includes("http.post('/clients', clientData)"), 'createClient should use /clients endpoint');
assert(clientApi.includes("http.put(`/clients/${clientId}`, clientData)"), 'updateClient should use /clients endpoint');

console.log('clientsMessagingAndApiRoutes.test.mjs passed');
