const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '../ui/src/pages/admin/components/AdminCategoryModals.jsx'), 'utf8');
assert(src.includes("workbasket.type === 'PRIMARY'"), 'subcategory workbasket dropdown must include PRIMARY-only filter');
assert(src.includes('workbasket.isActive !== false'), 'subcategory workbasket dropdown must exclude inactive workbaskets');
console.log('admin category workbasket dropdown filtering test passed');
