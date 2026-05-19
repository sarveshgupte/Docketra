const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '../src/controllers/category.controller.js'), 'utf8');
assert.ok(source.includes('const normalizeSubcategorySop ='), 'normalizeSubcategorySop helper should be defined in category.controller.js');
assert.ok(source.includes('normalizeSubcategorySop(sop, { actorXID: req.user?.xID })'), 'add/update subcategory should use normalizeSubcategorySop');

console.log('category subcategory sop controller static test passed');
