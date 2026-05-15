#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'src/services/signup.service.js'), 'utf8');
assert.ok(source.includes('RESERVED_FIRM_SLUG_SET'), 'signup service should maintain reserved slug set');
assert.ok(source.includes('firmSlug = `${firmSlug}-workspace`;'), 'reserved slug candidates should get safe suffix');

console.log('publicSignupReservedSlugFallback.test.js passed');
