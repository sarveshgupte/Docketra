#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const routes = read('ui/src/constants/routes.js');
const postLogin = read('ui/src/utils/postAuthNavigation.js');
const authService = read('ui/src/services/authService.js');
const routeGuards = read('ui/tests/postLoginFlowRegression.test.mjs');
const storageController = read('src/controllers/storage.controller.js');

assert.ok(routes.includes('DASHBOARD: (firmSlug)'), 'Firm dashboard route must exist.');
assert.ok(postLogin.includes('ROUTES.DASHBOARD(user.firmSlug)'), 'Firm login should resolve to firm dashboard.');
assert.ok(routes.includes('TASK_MANAGER: (firmSlug)'), 'Task manager route must exist.');
assert.ok(routes.includes('WORKLIST: (firmSlug)') && routes.includes('GLOBAL_WORKLIST: (firmSlug)'), 'Worklist/workbasket routes must exist.');
assert.ok(authService.includes('/auth/logout'), 'Logout endpoint must remain implemented.');
assert.ok(routeGuards.includes('Superadmin users must be allowed only in /app/superadmin namespace.'), 'Superadmin and firm routes must remain separated.');
assert.ok(storageController.includes('MANAGED_STORAGE_MODE') && storageController.includes('storageMode'), 'Managed storage fallback should remain available without BYOS.');

console.log('privatePilotSmoke.test.js passed');
