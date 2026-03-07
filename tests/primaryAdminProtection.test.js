const assert = require('assert');
const {
  assertCanDeactivateUser,
  assertCanDeleteUser,
  PrimaryAdminActionError,
} = require('../src/services/user.service');

function testPrimaryAdminCannotBeDeactivated() {
  assert.throws(
    () => assertCanDeactivateUser({ role: 'Admin', xID: 'X000001' }),
    (error) => error instanceof PrimaryAdminActionError && error.message === 'Primary admin cannot be deactivated'
  );
}

function testSystemPrimaryAdminCannotBeDeleted() {
  assert.throws(
    () => assertCanDeleteUser({ role: 'Admin', xID: 'X000777', isSystem: true }),
    (error) => error instanceof PrimaryAdminActionError && error.message === 'Primary admin cannot be deleted'
  );
}

function testRegularUserActionsAllowed() {
  assert.doesNotThrow(() => assertCanDeactivateUser({ role: 'Employee', xID: 'X000321' }));
  assert.doesNotThrow(() => assertCanDeleteUser({ role: 'Admin', xID: 'X000999' }));
}

function run() {
  testPrimaryAdminCannotBeDeactivated();
  testSystemPrimaryAdminCannotBeDeleted();
  testRegularUserActionsAllowed();
  console.log('primaryAdminProtection tests passed.');
}

run();
