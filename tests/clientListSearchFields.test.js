#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.resolve(process.cwd(), 'src/controllers/client.controller.js'), 'utf8');

assert.ok(source.includes("{ clientId: { $regex: escapedSearch, $options: 'i' } }"), 'Client list search should include clientId regex');
assert.ok(source.includes("{ businessName: { $regex: escapedSearch, $options: 'i' } }"), 'Client list search should include businessName regex');
assert.ok(source.includes("{ businessEmail: { $regex: escapedSearch, $options: 'i' } }"), 'Client list search should include businessEmail regex');

console.log('clientListSearchFields.test.js passed');
