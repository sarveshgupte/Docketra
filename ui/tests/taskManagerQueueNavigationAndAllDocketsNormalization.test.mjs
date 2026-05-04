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
assert.ok(taskManager.includes('All Dockets'), 'Task Manager should expose All Dockets label.');
assert.ok(taskManager.includes('not a pull queue'), 'All Dockets copy should clarify non-queue behavior.');

assert.ok(platformShell.includes('hasQcQueueAccess = hasAdminAccess || (Array.isArray(user?.qcWorkbaskets) && user.qcWorkbaskets.length > 0)'), 'QC nav visibility should require admin or explicit QC workbasket access.');
assert.ok(platformShell.includes('Go to QC Workbaskets'), 'Command center should use QC Workbaskets terminology.');

assert.ok(queries.includes("caseApi.getCases({ state: 'IN_QC', includeTerminated: false, limit: 50 })"), 'QC query should request IN_QC non-terminal dockets only.');

for (const [name, source] of [
  ['Workbaskets', workbaskets],
  ['QC Workbaskets', qcQueue],
]) {
  assert.ok(source.includes('No work available.'), `${name} should use successful empty-state work messaging.`);
  assert.ok(source.includes('No dockets found.'), `${name} should use successful empty-state filter messaging.`);
}

assert.ok(!casesColumns.includes('ASSIGN_TO_ME'), 'All Dockets row actions should not expose pull/assign queue behavior.');
assert.ok(casesColumns.includes('View Docket'), 'All Dockets should continue to support opening docket detail.');

assert.ok(casesPage.includes('CASE_STATUS.RESOLVED'), 'All Dockets filters should include RESOLVED records.');
assert.ok(casesPage.includes('CASE_STATUS.FILED'), 'All Dockets filters should include FILED records.');

console.log('taskManagerQueueNavigationAndAllDocketsNormalization.test.mjs passed');
