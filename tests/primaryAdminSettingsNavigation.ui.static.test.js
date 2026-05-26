const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

(function run() {
  const navSource = read('ui/src/constants/platformNavigation.js');
  const routesSource = read('ui/src/routes/ProtectedRoutes.jsx');
  const storageBadgeSource = read('ui/src/components/platform/StorageStatusBadge.jsx');
  const storageHookSource = read('ui/src/hooks/useStorageStatusSummary.js');

  assert(navSource.includes("section: 'Administration'"), 'Administration sidebar section must exist');
  assert(navSource.includes("minRole: 'ADMIN'"), 'Administration items must remain admin-gated');

  // PRIMARY_ADMIN + ADMIN visibility via minRole ADMIN and role-rank support.
  assert(navSource.includes("PRIMARY_ADMIN: 4"), 'PRIMARY_ADMIN must have highest role rank');
  assert(navSource.includes("ADMIN: 3"), 'ADMIN role rank must be defined');

  // Ensure USER is still below ADMIN, so USER cannot see Admin/Settings navigation.
  assert(navSource.includes('USER: 1'), 'USER role rank must remain lowest role');

  // Ensure normalization is case-safe for backend role shape variations.
  assert(navSource.includes("trim().toUpperCase().replace(/[\\s-]+/g, '_')"), 'Role normalization must be case and separator safe');

  // Ensure admin/settings links shown in sidebar are backed by registered protected routes.
  const protectedPaths = [
    'path="settings"',
    'path="settings/firm"',
    'path="settings/work"',
    'path="storage-settings"',
    'path="data-storage-map"',
    'path="admin"',
  ];
  protectedPaths.forEach((needle) => {
    assert(routesSource.includes(needle), `Protected route missing for ${needle}`);
  });

  // Storage popover links should target canonical routes from shared route constants.
  assert(storageHookSource.includes('storageSettingsPath: ROUTES.STORAGE_SETTINGS(activeFirmSlug)'), 'Storage Settings popover must use canonical storage settings route');
  assert(storageHookSource.includes('dataStorageMapPath: ROUTES.DATA_STORAGE_MAP(activeFirmSlug)'), 'Data Storage Map popover must use canonical data storage map route');
  assert(storageBadgeSource.includes('to={storageSettingsPath}'), 'Storage Settings popover link must point to storage settings path variable');
  assert(storageBadgeSource.includes('to={dataStorageMapPath}'), 'Data Storage Map popover link must point to data map path variable');

  console.log('primaryAdminSettingsNavigation.ui.static.test.js passed');
})();
