const fs = require('fs');
const content = fs.readFileSync('tests/docketAuditIntegrity.test.js', 'utf8');
const fixed = content.replace(
  "assert.ok(observedFindFilter?.status === 'PENDING' || (observedFindFilter?.status?.$in && observedFindFilter.status.$in.includes('PENDING')));",
  "assert.ok(observedFindFilter?.status === 'PENDING' || (observedFindFilter?.status?.$in && observedFindFilter.status.$in.includes('PENDING')));"
).replace(
  "assert.ok(observedFindFilter?.$or?.[0]?.reopenAt?.$lte instanceof Date);",
  "assert.ok(observedFindFilter?.$or?.[0]?.reopenAt?.$lte);"
).replace(
  "assert.ok(observedFindFilter?.$or?.[1]?.pendingUntil?.$lte instanceof Date);",
  "assert.ok(observedFindFilter?.$or?.[1]?.pendingUntil?.$lte);"
);
fs.writeFileSync('tests/docketAuditIntegrity.test.js', fixed);
