const fs = require('fs');
const assert = require('assert');

const source = fs.readFileSync('src/controllers/search.controller.js', 'utf8');
assert.ok(source.includes('Not allowed to view this workbasket'));
console.log('ok');
