#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

const createModal = read('ui/src/pages/admin/components/CreateUserModal.jsx');
assert.ok(createModal.includes("{ value: 'ADMIN', label: 'Admin' }"), 'dropdown should include canonical ADMIN value');
assert.ok(createModal.includes("{ value: 'MANAGER', label: 'Manager' }"), 'dropdown should include canonical MANAGER value');
assert.ok(createModal.includes("{ value: 'USER', label: 'Employee' }"), 'dropdown should include canonical USER value for Employee label');
assert.ok(!createModal.includes('Primary Admin'), 'dropdown should not expose Primary Admin role assignment');

const uiBulkSchema = read('ui/src/constants/bulkUploadSchema.js');
assert.ok(uiBulkSchema.includes('Role must be Admin, Manager, or Employee'), 'bulk helper copy should mention Admin/Manager/Employee');
assert.ok(uiBulkSchema.includes("['admin', 'manager', 'user', 'employee', 'staff']"), 'bulk validator should accept manager and employee/user aliases');

const adminRoleCopy = read('ui/src/pages/admin/adminRoleCopy.js');
assert.ok(adminRoleCopy.includes('Manager'), 'role guidance copy should include Manager');
assert.ok(!adminRoleCopy.includes('Partner'), 'role guidance copy should not advertise non-assignable Partner role');

console.log('teamManagementRoleOptions.test.js passed');
