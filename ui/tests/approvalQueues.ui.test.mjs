import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const pageSource = fs.readFileSync(path.resolve('ui/src/pages/ComplianceCalendarPage.jsx'), 'utf8');
const apiSource = fs.readFileSync(path.resolve('ui/src/api/dashboard.api.js'), 'utf8');

assert.ok(pageSource.includes('Approval Queues'), 'Compliance control room should show approval queues section.');
assert.ok(pageSource.includes('My approvals'), 'Approval queues should include My approvals view.');
assert.ok(pageSource.includes('Awaiting partner'), 'Approval queues should include Awaiting partner view.');
assert.ok(pageSource.includes('Awaiting client/signatory'), 'Approval queues should include Awaiting client/signatory view.');
assert.ok(pageSource.includes('Overdue approvals'), 'Approval queues should include Overdue approvals view.');
assert.ok(pageSource.includes('handleReminder'), 'Approval queues should support reminder placeholders.');

assert.ok(apiSource.includes('/dashboard/approval-queues'), 'Dashboard API should include approval queues endpoint.');
assert.ok(apiSource.includes('/dashboard/approval-queues/${caseId}/remind'), 'Dashboard API should include approval reminder endpoint.');

console.log('approval queues UI contract passed');
