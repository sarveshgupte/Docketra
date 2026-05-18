const fs = require('fs');
const path = require('path');

describe('worklist module boundaries', () => {
  test('mountTenantRoutes mounts worklists from dedicated worklistRoutes module', () => {
    const mountFile = fs.readFileSync(path.join(__dirname, '../src/app/routes/mountTenantRoutes.js'), 'utf8');
    expect(mountFile).toContain('worklistRoutes');
    expect(mountFile).toContain("app.use('/api/worklists', ...tenantScopedApiAccess, writeGuardChain, worklistRoutes);");
    expect(mountFile).toContain("app.use('/api/search', ...tenantScopedApiAccess, writeGuardChain, searchRoutes);");
  });

  test('worklist routes enforce validation and authorization on dedicated endpoints', () => {
    const routeFile = fs.readFileSync(path.join(__dirname, '../src/routes/worklist.routes.js'), 'utf8');
    expect(routeFile).toContain('applyRouteValidation');
    expect(routeFile).toContain("authorizeFirmPermission('CASE_VIEW')");
    expect(routeFile).toContain("router.get('/global'");
    expect(routeFile).toContain("router.get('/category/:categoryId'");
    expect(routeFile).toContain("router.get('/employee/me'");
    expect(routeFile).toContain("router.post('/employee/:caseId/move'");
    expect(routeFile).toContain("authorizeFirmPermission('CASE_ASSIGN')");
    expect(routeFile).toContain('checkCaseClientAccess');
  });
});
