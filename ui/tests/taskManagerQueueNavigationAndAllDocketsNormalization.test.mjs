import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const taskManager = read('ui/src/pages/platform/TaskManagerPage.jsx');
const platformShell = read('ui/src/components/platform/PlatformShell.jsx');
const qcQueue = read('ui/src/pages/platform/QcQueuePage.jsx');
const workbaskets = read('ui/src/pages/platform/WorkbasketsPage.jsx');
const worklist = read('ui/src/pages/platform/WorklistPage.jsx');
const casesPage = read('ui/src/pages/CasesPage.jsx');
const casesColumns = read('ui/src/components/cases/useCasesTableColumns.jsx');
const queries = read('ui/src/hooks/usePlatformDataQueries.js');

assert.ok(taskManager.includes('My Worklist'), 'Task Manager should expose My Worklist label.');
assert.ok(taskManager.includes('Workbaskets'), 'Task Manager should expose Workbaskets label.');
assert.ok(taskManager.includes('QC Workbaskets'), 'Task Manager should expose QC Workbaskets label.');
assert.ok(taskManager.includes('Next best destination'), 'Task Manager should frame the page as a smart execution hub.');
assert.ok(taskManager.includes('Available surfaces'), 'Task Manager should group the surfaces the current user can actually access.');
assert.ok(taskManager.includes('hasQcQueueAccess = hasFirmRoleAtLeast(role, \'ADMIN\') || assignedQcWorkbaskets.length > 0'), 'QC surfaces should only render for admin-wide or explicit QC access.');
assert.ok(taskManager.includes('QC Workbaskets are hidden until QC queue access is assigned.'), 'Task Manager should explain why QC is absent when the user has no QC queue access.');

assert.ok(platformShell.includes('hasQcQueueAccess = hasAdminAccess || (Array.isArray(user?.qcWorkbaskets) && user.qcWorkbaskets.length > 0)'), 'QC nav visibility should require admin or explicit QC workbasket access.');
assert.ok(platformShell.includes('Go to QC Workbench'), 'Command center should keep QC route shortcut terminology.');

assert.ok(queries.includes("caseApi.getCases({ status: CASE_STATUS.QC_PENDING, limit: 50 })"), 'QC query should request QC-pending dockets through the shared platform data hook.');

for (const [name, source] of [
  ['Workbaskets', workbaskets],
  ['QC Workbaskets', qcQueue],
]) {
  assert.ok(source.includes('No dockets are waiting'), `${name} should use queue-specific empty-state work messaging.`);
  assert.ok(source.includes('No dockets match') || source.includes('No QC dockets match'), `${name} should use clear filtered empty-state messaging.`);
}

assert.ok(casesColumns.includes('showQueueActions = true'), 'Column hook should support explicit queue-action visibility control.');
assert.ok(casesPage.includes('showQueueActions: false'), 'All Dockets should disable queue pull/assign behavior via explicit prop.');
assert.ok(casesColumns.includes('View Docket'), 'All Dockets should continue to support opening docket detail.');

assert.ok(casesPage.includes('CASE_STATUS.RESOLVED'), 'All Dockets filters should include RESOLVED records.');
assert.ok(casesPage.includes('CASE_STATUS.FILED'), 'All Dockets filters should include FILED records.');


assert.ok(taskManager.includes('Workbaskets'), 'Task Manager should show Workbaskets naming in user-facing copy.');
assert.ok(taskManager.includes('Go to Workbench'), 'Task Manager should preserve direct workbench quick action wording.');
assert.ok(taskManager.includes('Go to My Worklist'), 'Task Manager should preserve direct personal queue quick action wording.');
assert.ok(workbaskets.includes('Workbaskets'), 'Workbaskets page title should use Workbaskets naming.');
assert.ok(qcQueue.includes('QC Workbaskets'), 'QC page title should use QC Workbaskets naming.');
assert.ok(!read('docs/whats-new.md').includes('parent workbasket managers'), 'Whats new should not claim parent manager QC visibility unless explicitly implemented in this PR scope.');

console.log('taskManagerQueueNavigationAndAllDocketsNormalization.test.mjs passed');
