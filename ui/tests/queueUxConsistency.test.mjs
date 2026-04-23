import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const casesPage = read('src/pages/CasesPage.jsx');
const worklistView = read('views/WorklistView.jsx');
const workbasketPage = read('src/pages/WorkbasketPage.jsx');
const qcQueuePage = read('src/pages/platform/QcQueuePage.jsx');
const dataTable = read('src/components/common/DataTable.jsx');

for (const [name, source] of [
  ['CasesPage', casesPage],
  ['WorklistView', worklistView],
  ['WorkbasketPage', workbasketPage],
  ['QcQueuePage', qcQueuePage],
]) {
  assert.ok(!source.includes('window.confirm('), `${name} should not use browser confirm dialogs.`);
}

assert.ok(worklistView.includes('QueueFilterBar'), 'Worklist should use shared queue filter bar pattern.');
assert.ok(workbasketPage.includes('QueueFilterBar'), 'Workbasket should use shared queue filter bar pattern.');
assert.ok(qcQueuePage.includes('ActionConfirmModal'), 'QC queue actions should use in-app confirmation modal.');
assert.ok(dataTable.includes('tabIndex={onRowClick ? 0 : undefined}'), 'Shared DataTable should provide keyboard row focus for openable rows.');
assert.ok(dataTable.includes('focus-visible:ring-2'), 'Shared DataTable should render visible focus state for row navigation.');
assert.ok(dataTable.includes('refreshingMessage'), 'Shared DataTable should support background refresh messaging.');

console.log('queueUxConsistency.test.mjs passed');
