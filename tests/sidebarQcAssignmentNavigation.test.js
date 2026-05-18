const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.resolve(__dirname, '../ui/src/constants/platformNavigation.js'), 'utf8');

assert.ok(source.includes("ROUTES.WORKBASKET_DETAIL(firmSlug"), 'Sidebar should build direct primary workbasket detail links');
assert.ok(source.includes("ROUTES.QC_WORKBASKET_DETAIL(firmSlug"), 'Sidebar should build direct QC workbasket detail links');
assert.ok(source.includes("const assignedQcWorkbaskets = Array.isArray(accessContext?.qcWorkbaskets) ? accessContext.qcWorkbaskets : [];"), 'Sidebar should use assigned qcWorkbaskets from session payload');
assert.ok(source.includes("const showQcWorkbaskets = hasAtLeastRole(normalizedRole, 'MANAGER') || assignedQcWorkbaskets.length > 0;"), 'QC sidebar visibility should allow explicit assignment-based access');
assert.ok(!source.includes('ROUTES.QC_QUEUE(firmSlug)}?workbasketId='), 'Sidebar should not rely on generic filtered QC queue links');

console.log('sidebar QC assignment navigation tests passed');
