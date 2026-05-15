#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { RESERVED_FIRM_SLUGS } = require('../src/middleware/firmSlugGuard.middleware');

assert.ok(RESERVED_FIRM_SLUGS.includes('auth'), 'auth slug must be reserved');
assert.ok(RESERVED_FIRM_SLUGS.includes('api'), 'api slug must be reserved to prevent route namespace takeover');
assert.ok(RESERVED_FIRM_SLUGS.includes('superadmin'), 'superadmin slug must be reserved');

console.log('signupReservedSlugGuard.test.js passed');
