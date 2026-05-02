#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '../src/app/routes/mountPlatformRoutes.js'), 'utf8');

const iAdmin = source.indexOf("app.use('/api/admin'");
const iUsers = source.indexOf("app.use('/api/users'");
const iAuth = source.indexOf("['/api/auth', '/auth']");
const iPublic = source.indexOf("app.use('/api/public'");
const iSuperadmin = source.indexOf("['/api/sa', '/api/superadmin', '/superadmin']");
const iTenantSlug = source.indexOf("app.use('/api/:firmSlug', firmSlugGuard, firmRoutes)");

assert.ok(iTenantSlug > -1, 'tenant slug mount must exist');
for (const [name, idx] of Object.entries({ iAuth, iPublic, iSuperadmin, iAdmin })) {
  assert.ok(idx > -1, `${name} mount must exist`);
  assert.ok(idx < iTenantSlug, `${name} must be mounted before /api/:firmSlug`);
}
assert.ok(iUsers === -1, 'users routes should not be in platform mounts');

console.log('routeMountOrderContract.test.js passed');
