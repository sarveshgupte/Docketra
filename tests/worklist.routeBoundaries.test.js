#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

(function run() {
  const mountFile = fs.readFileSync(path.join(__dirname, '../src/app/routes/mountTenantRoutes.js'), 'utf8');
  assert(mountFile.includes('worklistRoutes'), 'Expected mountTenantRoutes to reference worklistRoutes');
  assert(
    mountFile.includes("app.use('/api/worklists', ...tenantScopedApiAccess, writeGuardChain, worklistRoutes);"),
    'Expected /api/worklists to mount dedicated worklistRoutes',
  );
  assert(
    mountFile.includes("app.use('/api/search', ...tenantScopedApiAccess, writeGuardChain, searchRoutes);"),
    'Expected /api/search to mount searchRoutes',
  );

  const routeFile = fs.readFileSync(path.join(__dirname, '../src/routes/worklist.routes.js'), 'utf8');
  assert(routeFile.includes('applyRouteValidation'), 'Expected applyRouteValidation in worklist routes');
  assert(routeFile.includes("authorizeFirmPermission('CASE_VIEW')"), 'Expected CASE_VIEW guard on read worklists');
  assert(routeFile.includes("router.get('/global'"), 'Expected /global route');
  assert(routeFile.includes("router.get('/category/:categoryId'"), 'Expected /category/:categoryId route');
  assert(routeFile.includes("router.get('/employee/me'"), 'Expected /employee/me route');
  assert(routeFile.includes("router.post('/employee/:caseId/move'"), 'Expected /employee/:caseId/move route');
  assert(routeFile.includes("authorizeFirmPermission('CASE_ASSIGN')"), 'Expected CASE_ASSIGN guard on move route');
  assert(routeFile.includes('checkCaseClientAccess'), 'Expected checkCaseClientAccess on move route');

  console.log('worklist.routeBoundaries.test.js passed');
})();
