const assert = require('assert');
const casePolicy = require('../src/policies/case.policy');
const clientPolicy = require('../src/policies/client.policy');
const categoryPolicy = require('../src/policies/category.policy');
const userPolicy = require('../src/policies/user.policy');
const superadminPolicy = require('../src/policies/superadmin.policy');

const U = (role) => ({ role });

(function run() {
  assert.equal(casePolicy.canDelete(U('PRIMARY_ADMIN')), true);
  assert.equal(clientPolicy.canCreate(U('PRIMARY_ADMIN')), true);

  assert.equal(casePolicy.canDelete(U('ADMIN')), true);
  assert.equal(userPolicy.canManagePermissions(U('ADMIN')), true);

  assert.equal(casePolicy.canDelete(U('MANAGER')), false);
  assert.equal(casePolicy.canView(U('MANAGER')), true);

  assert.equal(casePolicy.canDelete(U('USER')), false);
  assert.equal(casePolicy.canView(U('USER')), true);

  assert.equal(casePolicy.canView(U('Employee')), true);
  assert.equal(casePolicy.canDelete(U('Employee')), false);
  assert.equal(casePolicy.canDelete(U('Admin')), true);

  assert.equal(superadminPolicy.cannotAccessFirmData(U('SUPERADMIN')), false);
  assert.equal(superadminPolicy.cannotAccessFirmData(U('SUPER_ADMIN')), false);
  assert.equal(superadminPolicy.cannotAccessFirmData(U('SuperAdmin')), false);

  assert.equal(categoryPolicy.canView(U('SUPERADMIN')), false);
  console.log('role contract canonical policy tests passed');
})();
