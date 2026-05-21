const assert = require('assert');
const fs = require('fs');
const path = require('path');

const read = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const mountSource = read('src/app/routes/mountTenantRoutes.js');
const routeSource = read('src/routes/worklist.routes.js');

assert.ok(mountSource.includes("app.use('/api/worklists', ...tenantScopedApiAccess, writeGuardChain, worklistRoutes);"), 'Worklist routes should be mounted under tenant-scoped /api/worklists path.');
assert.ok(routeSource.includes("router.get('/employee/me', authorizeFirmPermission('CASE_VIEW'), searchLimiter, employeeWorklist);"), 'Employee worklist route should remain mounted with CASE_VIEW authorization and rate limiter.');

console.log('worklistEmployeeRouteMount.test.js passed');
