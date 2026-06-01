import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const pageSource = fs.readFileSync(path.resolve('ui/src/pages/ComplianceCalendarPage.jsx'), 'utf8');
const apiSource = fs.readFileSync(path.resolve('ui/src/api/dashboard.api.js'), 'utf8');

assert.ok(pageSource.includes('Partner Morning Dashboard'), 'Compliance page should expose partner morning dashboard section.');
assert.ok(pageSource.includes('At-risk entities'), 'Partner morning dashboard should show At-risk entities section.');
assert.ok(pageSource.includes('Client blockers'), 'Partner morning dashboard should show Client blockers section.');
assert.ok(pageSource.includes('Approval blockers'), 'Partner morning dashboard should show Approval blockers section.');
assert.ok(pageSource.includes('Team load'), 'Partner morning dashboard should show Team load section.');
assert.ok(pageSource.includes('Exceptions'), 'Partner morning dashboard should show Exceptions section.');
assert.ok(pageSource.includes('All exception reasons'), 'Partner morning dashboard should expose exception filter.');
assert.ok(pageSource.includes('Approver XID'), 'Partner morning dashboard should expose approver filter.');

assert.ok(apiSource.includes('/dashboard/partner-morning'), 'Dashboard API should include partner morning endpoint.');

console.log('partner morning dashboard UI contract passed');
