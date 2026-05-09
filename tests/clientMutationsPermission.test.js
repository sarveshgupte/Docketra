#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const routesSource = fs.readFileSync(path.join(process.cwd(), 'src', 'routes', 'client.routes.js'), 'utf8');

const mutationRoutes = [
  "router.post('/', authorizeFirmPermission('CLIENT_MANAGE')",
  "router.put('/:clientId', authorizeFirmPermission('CLIENT_MANAGE')",
  "router.patch('/:clientId/status', authorizeFirmPermission('CLIENT_MANAGE')",
  "router.post('/:clientId/change-name', authorizeFirmPermission('CLIENT_MANAGE')",
  "router.put('/:clientId/fact-sheet', authorizeFirmPermission('CLIENT_MANAGE')",
  "router.post('/:clientId/cfs/files/upload-intent', authorizeFirmPermission('CLIENT_MANAGE')",
  "router.post('/:clientId/cfs/files/finalize', authorizeFirmPermission('CLIENT_MANAGE')",
  "router.post('/:clientId/cfs/files', authorizeFirmPermission('CLIENT_MANAGE')",
  "router.delete('/:clientId/cfs/files/:attachmentId', authorizeFirmPermission('CLIENT_MANAGE')",
];

for (const expected of mutationRoutes) {
  assert(routesSource.includes(expected), `Missing required CLIENT_MANAGE guard: ${expected}`);
}

console.log('clientMutationsPermission.test.js passed');
