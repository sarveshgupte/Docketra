import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const uiRoot = process.cwd();
const navSource = fs.readFileSync(path.join(uiRoot, 'ui', 'src', 'constants', 'platformNavigation.js'), 'utf8');
const protectedRouteSource = fs.readFileSync(path.join(uiRoot, 'ui', 'src', 'components', 'auth', 'ProtectedRoute.jsx'), 'utf8');
const protectedRoutesSource = fs.readFileSync(path.join(uiRoot, 'ui', 'src', 'routes', 'ProtectedRoutes.jsx'), 'utf8');
const clientsPageSource = fs.readFileSync(path.join(uiRoot, 'ui', 'src', 'pages', 'ClientsPage.jsx'), 'utf8');
const platformShellSource = fs.readFileSync(path.join(uiRoot, 'ui', 'src', 'components', 'platform', 'PlatformShell.jsx'), 'utf8');

assert(navSource.includes("if (item.id === 'clients') return canManageClients(accessContext);"));
assert(navSource.includes('resolveAccessContext'));
assert(protectedRouteSource.includes('requireClientManage = false'));
assert(protectedRouteSource.includes('canManageClients(user)'));
assert(protectedRoutesSource.includes('<ProtectedRoute requireClientManage>'));
assert(clientsPageSource.includes('canManageClientsByRoleOrPermission(user)'));
assert(clientsPageSource.includes('actions={canManageClients ? ('));
assert(platformShellSource.includes('getPlatformNavigation(firmSlug, { role, permissions: user?.permissions })'));
assert(platformShellSource.includes('getPlatformDestinationCommands(firmSlug, { role, permissions: user?.permissions })'));
console.log('clientsAccessControl.test.mjs passed');
