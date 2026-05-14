#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

const createModal = read('ui/src/pages/admin/components/CreateUserModal.jsx');
assert.ok(createModal.includes("{ value: 'Admin', label: 'Admin' }"), 'dropdown should include Admin');
assert.ok(createModal.includes("{ value: 'Manager', label: 'Manager' }"), 'dropdown should include Manager');
assert.ok(createModal.includes("{ value: 'Employee', label: 'Employee' }"), 'dropdown should include Employee');
assert.ok(!createModal.includes('Primary Admin'), 'dropdown should not expose Primary Admin role assignment');

const uiBulkSchema = read('ui/src/constants/bulkUploadSchema.js');
assert.ok(uiBulkSchema.includes('Role must be Admin, Manager, or Employee'), 'bulk helper copy should mention Admin/Manager/Employee');
assert.ok(uiBulkSchema.includes("['admin', 'manager', 'user', 'employee', 'staff']"), 'bulk validator should accept manager and employee/user aliases');

console.log('teamManagementRoleOptions.test.js passed');
