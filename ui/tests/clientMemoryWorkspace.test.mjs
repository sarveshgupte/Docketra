import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (p) => fs.readFileSync(path.resolve(process.cwd(), p), 'utf8');

const routes = read('src/constants/routes.js');
const protectedRoutes = read('src/routes/ProtectedRoutes.jsx');
const workspacePage = read('src/pages/ClientWorkspacePage.jsx');

assert.ok(routes.includes('CLIENT_WORKSPACE: (firmSlug, clientId) => `/app/firm/${firmSlug}/clients/${clientId}`'), 'Client workspace route constant should remain unchanged.');
assert.ok(protectedRoutes.includes('path="clients/:clientId"'), 'Client workspace route should remain registered.');
assert.ok(workspacePage.includes('Client Memory'), 'Client workspace should use Client Memory language.');
assert.ok(workspacePage.includes('Company Brain context'), 'Client workspace should include Company Brain context callout.');
assert.ok(workspacePage.includes('Linked work will appear here as dockets are connected to this client.'), 'Client workspace should include linked work empty state copy.');
assert.ok(workspacePage.includes('Linked documents and references will appear here as client files are connected through Docketra.'), 'Client workspace should include documents empty state copy.');
assert.equal(
  workspacePage.includes('vector') || workspacePage.includes('embeddings') || workspacePage.includes('document extraction'),
  false,
  'Client Memory workspace should not introduce AI/vector/document extraction infrastructure.'
);

console.log('clientMemoryWorkspace.test.mjs passed');
