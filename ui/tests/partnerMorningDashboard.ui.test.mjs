import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const pageSource = fs.readFileSync(path.resolve('ui/src/pages/ComplianceCalendarPage.jsx'), 'utf8');
const apiSource = fs.readFileSync(path.resolve('ui/src/api/dashboard.api.js'), 'utf8');
const protectedRoutesSource = fs.readFileSync(path.resolve('ui/src/routes/ProtectedRoutes.jsx'), 'utf8');

assert.ok(pageSource.includes('Operations Command Dashboard'), 'Compliance page should expose operations command dashboard section.');
assert.ok(pageSource.includes('At-risk entities'), 'Operations command dashboard should show At-risk entities section.');
assert.ok(pageSource.includes('Client blockers'), 'Operations command dashboard should show Client blockers section.');
assert.ok(pageSource.includes('Approval blockers'), 'Operations command dashboard should show Approval blockers section.');
assert.ok(pageSource.includes('Team load'), 'Operations command dashboard should show Team load section.');
assert.ok(pageSource.includes('Exceptions'), 'Operations command dashboard should show Exceptions section.');
assert.ok(pageSource.includes('All exception reasons'), 'Operations command dashboard should expose exception filter.');
assert.ok(pageSource.includes('Approver XID'), 'Operations command dashboard should expose approver filter.');
assert.ok(!pageSource.includes('Partner Morning Dashboard'), 'Compliance page should not use Partner role language.');

assert.ok(apiSource.includes('/dashboard/partner-morning'), 'Dashboard API should include partner morning endpoint.');
assert.ok(apiSource.includes('compactParams'), 'Dashboard API should strip empty filter params before strict validation.');
assert.ok(
  protectedRoutesSource.includes('path="compliance-calendar"')
    && protectedRoutesSource.includes('<ProtectedRoute requireManagerOrAbove>'),
  'Compliance Control Room route should require Manager or above.'
);

console.log('operations command dashboard UI contract passed');
