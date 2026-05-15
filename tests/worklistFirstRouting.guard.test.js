const assert = require('assert');
const fs = require('fs');
const path = require('path');

function read(file) {
  return fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
}

function run() {
  const authContext = read('ui/src/contexts/AuthContext.jsx');
  assert(authContext.includes('/worklist`'), 'AuthContext post-auth route should default to worklist for firm users.');

  const defaultRoute = read('ui/src/components/routing/DefaultRoute.jsx');
  assert(defaultRoute.includes('ROUTES.WORKLIST(user.firmSlug)'), 'DefaultRoute should send firm users to worklist.');
  assert(defaultRoute.includes('ROUTES.SUPERADMIN_DASHBOARD'), 'DefaultRoute should preserve superadmin dashboard routing.');


  const layout = read('ui/src/components/common/Layout.jsx');
  assert(layout.includes("const hasManagerAccess = normalizedRole === 'MANAGER';"), 'Layout should compute manager access from normalized role.');
  assert(layout.includes("hidden: !(hasAdminAccess || hasManagerAccess)"), 'Reports visibility should be based on admin-or-manager access.');
  assert(!layout.includes("hasManagerAccess = userRole === 'manager'"), 'Layout should not rely on raw/lowercase userRole manager checks.');

  const protectedRoutes = read('ui/src/routes/ProtectedRoutes.jsx');
  assert(protectedRoutes.includes('path="dashboard"'), 'Dashboard compatibility route should still exist.');
  assert(protectedRoutes.includes('<Navigate to="../worklist" replace />'), 'Dashboard route should redirect to worklist.');

  console.log('Worklist-first routing guard tests passed.');
}

run();
