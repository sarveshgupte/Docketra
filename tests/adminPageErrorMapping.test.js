#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const adminUtils = fs.readFileSync(path.resolve(__dirname, '../ui/src/pages/admin/adminPageUtils.js'), 'utf8');
const adminPage = fs.readFileSync(path.resolve(__dirname, '../ui/src/pages/AdminPage.jsx'), 'utf8');

assert(adminUtils.includes("if (status === 401) return 'unauthorized';"), '401 must map to unauthorized');
assert(adminUtils.includes("if (status === 403) return 'forbidden';"), '403 must map to forbidden');

assert(adminPage.includes('Session expired. Please log in again.'), '401 toast copy must be explicit');
assert(adminPage.includes('You do not have permission to view this section.'), '403 toast copy must be explicit');
assert(adminPage.includes('Server error. Please try again.'), '5xx toast copy must be explicit');
assert(adminPage.includes('Unable to connect to server'), 'network toast copy must remain');

console.log('adminPageErrorMapping.test.js passed');
