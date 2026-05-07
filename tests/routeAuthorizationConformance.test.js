#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

const read = (relPath) => fs.readFileSync(path.join(repoRoot, relPath), 'utf8');

(() => {
  const superadminRoutes = read('src/routes/superadmin.routes.js');
  assert.match(superadminRoutes, /router\.use\(requireSuperadmin\);/, 'superadmin router must enforce requireSuperadmin for every endpoint');

  const tenantMounts = read('src/app/routes/mountTenantRoutes.js');
  assert.match(tenantMounts, /forbidSuperAdmin:\s*true/, 'tenant-scoped mounts must forbid superadmin on firm routes');
  assert.match(tenantMounts, /app\.use\('\/api\/users',\s*\.\.\.tenantScopedApiAccess/, 'protected tenant route should require tenantScopedApiAccess');

  const platformMounts = read('src/app/routes/mountPlatformRoutes.js');
  assert.match(platformMounts, /\['\/api\/sa', '\/api\/superadmin', '\/superadmin'\]\.forEach\(/, 'all superadmin namespaces should be mounted consistently');

  const firmSlugGuard = read('src/middleware/firmSlugGuard.middleware.js');
  assert.match(firmSlugGuard, /RESERVED_FIRM_SLUGS/, 'reserved namespaces must be guarded from firmSlug takeover');

  console.log('routeAuthorizationConformance.test.js passed');
})();
