/**
 * Organization Structure & Hierarchy Module Tests
 * Verifies:
 * 1. getHierarchyTree permission & data contract (accessible to all firm members with USER_VIEW)
 * 2. updateUserHierarchy exclusivity (strictly restricted to PRIMARY_ADMIN)
 * 3. Frontend routing, navigation, and settings integration
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Organization Structure - Backend Controller & Permissions Contract', async (t) => {
  const adminControllerSource = fs.readFileSync(
    path.resolve(__dirname, '../src/controllers/admin.controller.js'),
    'utf8'
  );

  // 1. getHierarchyTree should NOT require primary admin (allows all firm users to view org chart)
  const getHierarchyTreeMatch = adminControllerSource.match(
    /const getHierarchyTree = async \([\s\S]*?^};/m
  );
  assert.ok(getHierarchyTreeMatch, 'getHierarchyTree function should exist in admin.controller.js');
  const getHierarchyTreeBody = getHierarchyTreeMatch[0];

  assert.ok(
    !getHierarchyTreeBody.includes('assertPrimaryAdmin'),
    'getHierarchyTree must NOT require assertPrimaryAdmin so all firm members can view the org structure'
  );

  assert.ok(
    getHierarchyTreeBody.includes('stats:'),
    'getHierarchyTree should return summary statistics'
  );

  assert.ok(
    getHierarchyTreeBody.includes('department') && getHierarchyTreeBody.includes('phoneNumber'),
    'getHierarchyTree should query department and phoneNumber for member profiles'
  );

  // 2. updateUserHierarchy MUST strictly require primary admin
  const updateUserHierarchyMatch = adminControllerSource.match(
    /const updateUserHierarchy = async \([\s\S]*?^};/m
  );
  assert.ok(updateUserHierarchyMatch, 'updateUserHierarchy function should exist in admin.controller.js');
  const updateUserHierarchyBody = updateUserHierarchyMatch[0];

  assert.ok(
    updateUserHierarchyBody.includes('assertPrimaryAdmin(req.user)'),
    'updateUserHierarchy must strictly enforce assertPrimaryAdmin'
  );

  assert.ok(
    updateUserHierarchyBody.includes('HIERARCHY_UPDATED'),
    'updateUserHierarchy must record an audit event for governance'
  );
});

test('Organization Structure - Route Schema & Mount Contract', async (t) => {
  const adminRoutesSource = fs.readFileSync(
    path.resolve(__dirname, '../src/routes/admin.routes.js'),
    'utf8'
  );

  assert.ok(
    adminRoutesSource.includes("router.get('/hierarchy'"),
    'GET /api/admin/hierarchy route should be mounted'
  );

  assert.ok(
    adminRoutesSource.includes("router.patch('/users/:id/hierarchy'"),
    'PATCH /api/admin/users/:id/hierarchy route should be mounted'
  );

  assert.ok(
    adminRoutesSource.includes("requirePrimaryAdmin, authorizeFirmPermission('USER_MANAGE'), userWriteLimiter, updateUserHierarchy"),
    'PATCH /users/:id/hierarchy must require requirePrimaryAdmin middleware'
  );
});

test('Organization Structure - Frontend Integration Contract', async (t) => {
  const hierarchyPageSource = fs.readFileSync(
    path.resolve(__dirname, '../ui/src/pages/HierarchyPage.jsx'),
    'utf8'
  );

  assert.ok(
    hierarchyPageSource.includes('export const HierarchyPage = () =>'),
    'HierarchyPage component should be exported'
  );

  assert.ok(
    hierarchyPageSource.includes('reportingChain'),
    'HierarchyPage should calculate upward reporting chain'
  );

  assert.ok(
    hierarchyPageSource.includes('directReports'),
    'HierarchyPage should calculate downward direct reports'
  );

  assert.ok(
    hierarchyPageSource.includes('handleSaveReportingLine'),
    'HierarchyPage should provide save reporting line handler'
  );

  assert.ok(
    hierarchyPageSource.includes('isPrimaryAdmin'),
    'HierarchyPage should check isPrimaryAdmin for mutation controls'
  );

  // Routing integration
  const protectedRoutesSource = fs.readFileSync(
    path.resolve(__dirname, '../ui/src/routes/ProtectedRoutes.jsx'),
    'utf8'
  );

  assert.ok(
    protectedRoutesSource.includes('path="admin/hierarchy"'),
    'ProtectedRoutes should register admin/hierarchy route'
  );

  assert.ok(
    protectedRoutesSource.includes('path="hierarchy"'),
    'ProtectedRoutes should register alias hierarchy route'
  );

  // Settings integration
  const settingsPageSource = fs.readFileSync(
    path.resolve(__dirname, '../ui/src/pages/platform/SettingsPage.jsx'),
    'utf8'
  );

  assert.ok(
    settingsPageSource.includes("title: 'Organization Structure'"),
    'SettingsPage should expose Organization Structure card'
  );

  assert.ok(
    settingsPageSource.includes('ROUTES.HIERARCHY(firmSlug)'),
    'SettingsPage should link to ROUTES.HIERARCHY'
  );

  // Users & Team View Switcher
  const adminPageSource = fs.readFileSync(
    path.resolve(__dirname, '../ui/src/pages/AdminPage.jsx'),
    'utf8'
  );

  assert.ok(
    adminPageSource.includes('ROUTES.HIERARCHY(firmSlug)'),
    'AdminPage should link to hierarchy from team section'
  );

  const usersSectionSource = fs.readFileSync(
    path.resolve(__dirname, '../ui/src/pages/admin/components/AdminUsersSection.jsx'),
    'utf8'
  );

  assert.ok(
    usersSectionSource.includes('onViewOrgChart'),
    'AdminUsersSection should support onViewOrgChart prop'
  );
});
