#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const src = fs.readFileSync('src/security/encryption.service.js','utf8');
assert.ok(!src.includes('valueStart'), 'encryption logs must not include valueStart fragments');
assert.ok(!src.includes('valueEnd'), 'encryption logs must not include valueEnd fragments');
console.log('encryption log sanitization test passed');
