import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const button = read('src/components/common/Button.jsx');
const dataTable = read('src/components/common/DataTable.jsx');
const queueFilterBar = read('src/components/common/QueueFilterBar.jsx');
const createUserModal = read('src/pages/admin/components/CreateUserModal.jsx');
const adminUsersSection = read('src/pages/admin/components/AdminUsersSection.jsx');
const userAccessModal = read('src/pages/admin/components/UserAccessModal.jsx');

assert.ok(button.includes('small: \'sm\''), 'Button should normalize legacy "small" alias to "sm".');
assert.ok(button.includes('medium: \'md\''), 'Button should normalize legacy "medium" alias to "md".');
assert.ok(button.includes('warning: \'danger\''), 'Button should normalize warning variant to danger styling.');
assert.ok(button.includes('allowUnsafeClassName'), 'Button should expose explicit unsafe className opt-in for custom styling.');

assert.ok(!dataTable.includes('size="small"'), 'DataTable should use canonical button sizes.');
assert.ok(queueFilterBar.includes('size="sm"'), 'QueueFilterBar clear action should use canonical small size.');

for (const [name, source] of [
  ['CreateUserModal', createUserModal],
  ['AdminUsersSection', adminUsersSection],
  ['UserAccessModal', userAccessModal],
]) {
  assert.ok(!source.includes('neo-info-text'), `${name} should not rely on legacy neo info-text class.`);
  assert.ok(!source.includes('neo-form-group'), `${name} should not rely on legacy neo form group class.`);
}

console.log('designSystemContract.test.mjs passed');
