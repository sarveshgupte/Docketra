const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.resolve(__dirname, '../ui/src/pages/AdminPage.jsx'), 'utf8');

assert.ok(source.includes('const qcOnlyWorkbaskets = useMemo('), 'Admin page should define qcOnlyWorkbaskets derived collection');
assert.ok(
  source.includes('const selectedQcIds = selectedWorkbasketDraft.filter((teamId) => qcOnlyWorkbaskets.some((wb) => String(wb?._id) === String(teamId)));'),
  'Save access flow must use qcOnlyWorkbaskets when detecting explicit QC assignments'
);
assert.ok(!source.includes('selectedWorkbasketDraft.filter((teamId) => qcWorkbaskets.some('), 'Save access flow must not reference undefined qcWorkbaskets');

console.log('admin page QC assignment source tests passed');
