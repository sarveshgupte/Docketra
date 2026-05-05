const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const controllerSource = fs.readFileSync(path.join(root, 'src/controllers/auth.controller.js'), 'utf8');
const routeSource = fs.readFileSync(path.join(root, 'src/routes/auth.routes.js'), 'utf8');
const schemaSource = fs.readFileSync(path.join(root, 'src/schemas/auth.routes.schema.js'), 'utf8');

assert(controllerSource.includes("if (!/^X\\d{6}$/.test(xid))"), 'Invalid xID should return generic empty result.');
assert(controllerSource.includes("data: { workspaces: [] }"), 'No-match flows should return generic empty workspaces list.');
assert(controllerSource.includes("status: 'active'"), 'Active workspace filter should use status-based convention.');
assert(controllerSource.includes("{ isActive: true }"), 'Active workspace filter should support legacy isActive field.');
assert(controllerSource.includes("firmId: { $in: stringRefs }"), 'Workspace lookup must support string firmId mappings.');
assert(controllerSource.includes("_id: { $in: objectIdRefs }"), 'Workspace lookup must support ObjectId mappings.');
assert(!controllerSource.includes('workspaces: firms'), 'Workspace response must be explicit safe projection.');
assert(!controllerSource.includes('status: String(firm.status'), 'Workspace response must not expose status field.');

assert(routeSource.includes("router.post('/find-workspace', authBlockEnforcer, authLimiter, sensitiveLimiter, findWorkspaceByXid);"), 'find-workspace should use strict rate limiting middleware chain.');
assert(schemaSource.includes("'POST /find-workspace'"), 'find-workspace route schema must exist.');
assert(schemaSource.includes('xid: xidString'), 'find-workspace schema should require xID format.');

console.log('authFindWorkspace.contract.test.js passed');
