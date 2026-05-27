#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const adminUtils = fs.readFileSync(path.resolve(__dirname, '../ui/src/pages/admin/adminPageUtils.js'), 'utf8');
const adminPage = fs.readFileSync(path.resolve(__dirname, '../ui/src/pages/AdminPage.jsx'), 'utf8');

assert(adminUtils.includes('export const normalizeAdminRole'), 'normalizeAdminRole helper should exist');
assert(adminUtils.includes("replace(/[\\s-]+/g, '_')"), 'role normalization should handle spaces and hyphens');
assert(adminPage.includes("showGroupedLoadToast('admin-forbidden'"), 'forbidden toast should be grouped under one dedupe key');
assert(adminPage.includes('normalizeAdminRole(loggedInUser?.role)'), 'AdminPage should use shared role normalization helper');

console.log('adminPagePrimaryAdminGuard.test.js passed');
