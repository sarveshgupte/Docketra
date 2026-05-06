#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.resolve(__dirname, '../src/controllers/client.controller.js'), 'utf8');

assert.ok(source.includes("message: 'Business name is required'"), 'businessName must remain required');
assert.equal(source.includes("message: 'Primary contact number is required'"), false, 'phone should be optional in MVP');
assert.equal(source.includes("message: 'Business email is required'"), false, 'email should be optional in MVP');
assert.ok(source.includes("typeof primaryContactNumber === 'string' && primaryContactNumber.trim()"), 'phone should only be persisted when provided');
assert.ok(source.includes("typeof businessEmail === 'string' && businessEmail.trim()"), 'email should only be persisted when provided');

console.log('clientCreateMvpValidation.test.js passed');
