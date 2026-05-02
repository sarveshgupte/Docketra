const assert = require('assert');
const casePolicy = require('../src/policies/case.policy');
const clientPolicy = require('../src/policies/client.policy');
const categoryPolicy = require('../src/policies/category.policy');
const userPolicy = require('../src/policies/user.policy');
const superadminPolicy = require('../src/policies/superadmin.policy');
const { normalizeRole } = require('../src/utils/role.utils');

const U = (role) => ({ role });

(function run() {
  // PRIMARY_ADMIN: highest firm role privileges
  assert.equal(casePolicy.canDelete(U('PRIMARY_ADMIN')), true);
  assert.equal(clientPolicy.canCreate(U('PRIMARY_ADMIN')), true);
  assert.equal(userPolicy.canManagePermissions(U('PRIMARY_ADMIN')), true);

  // ADMIN: admin privileges, but not primary-admin-only flows (outside these policies)
  assert.equal(casePolicy.canDelete(U('ADMIN')), true);
  assert.equal(userPolicy.canManagePermissions(U('ADMIN')), true);

  // MANAGER: manager-level access only
  assert.equal(casePolicy.canView(U('MANAGER')), true);
  assert.equal(casePolicy.canDelete(U('MANAGER')), false);
  assert.equal(clientPolicy.canCreate(U('MANAGER')), false);

  // USER: basic docket access only, no client/category/user-directory admin access
  assert.equal(casePolicy.canView(U('USER')), true);
  assert.equal(clientPolicy.canView(U('USER')), false);
  assert.equal(categoryPolicy.canView(U('USER')), false);
  assert.equal(userPolicy.canView(U('USER')), false);

  // Legacy aliases are compatibility-normalized only; no privilege escalation
  assert.equal(normalizeRole('Admin'), 'ADMIN');
  assert.equal(normalizeRole('Employee'), 'USER');
  assert.equal(casePolicy.canDelete(U('Admin')), true); // alias of ADMIN
  assert.equal(casePolicy.canDelete(U('Employee')), false); // alias of USER
  assert.equal(clientPolicy.canCreate(U('Employee')), false);

  // Superadmin variants are denied on firm-scoped business-data policy paths
  assert.equal(superadminPolicy.cannotAccessFirmData(U('SUPERADMIN')), true);
  assert.equal(superadminPolicy.cannotAccessFirmData(U('SUPER_ADMIN')), true);
  assert.equal(superadminPolicy.cannotAccessFirmData(U('SuperAdmin')), true);

  assert.equal(casePolicy.canView(U('SUPER_ADMIN')), false);
  assert.equal(clientPolicy.canView(U('SUPER_ADMIN')), false);
  assert.equal(categoryPolicy.canView(U('SUPER_ADMIN')), false);
  assert.equal(userPolicy.canView(U('SUPER_ADMIN')), false);

  console.log('role contract canonical policy tests passed');
})();
