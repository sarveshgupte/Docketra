import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const workbaskets = read('src/pages/platform/WorkbasketsPage.jsx');
const worklist = read('src/pages/platform/WorklistPage.jsx');
const qcQueue = read('src/pages/platform/QcQueuePage.jsx');
const casesPage = read('src/pages/CasesPage.jsx');
const css = read('src/components/platform/platform.css');
const whatsNew = read('../docs/whats-new.md');

assert.ok(workbaskets.includes('title="Workbaskets"'), 'Workbaskets should render in PlatformShell context.');
assert.ok(workbaskets.includes('No dockets are waiting in your workbaskets.'), 'Workbaskets should use queue-specific empty copy.');
assert.ok(workbaskets.includes('StatGrid items={metrics}'), 'Workbaskets should include queue summary metrics.');
assert.ok(workbaskets.includes('tableClassName="queue-table"'), 'Workbaskets should use shared queue table styling.');
assert.ok(workbaskets.includes("{ label: 'Assigned', value:"), 'Workbaskets metric label should not imply user-specific ownership when not identity-filtered.');
assert.ok(workbaskets.includes('error=""'), 'Workbaskets should avoid duplicate top-level + table-level query errors.');

assert.ok(worklist.includes("title={scopedWorkbasket ? `Worklist — ${scopedWorkbasket.name}` : 'My Worklist'}"), 'Worklist title should support scoped and fallback variants.');
assert.ok(worklist.includes('className="filter-bar__checkbox"'), 'My Worklist should preserve compact checkbox styling.');
assert.ok(worklist.includes('error=""'), 'My Worklist should suppress duplicate table-level errors.');
assert.ok(worklist.includes('title="Personal execution queue"'), 'My Worklist should communicate personal queue ownership.');
assert.equal(worklist.includes('<option value=\"IN_QC\">In QC</option>'), false, 'Normal worklist status filter should not include In QC.');

assert.ok(qcQueue.includes('title="QC Workbaskets"'), 'QC queue should render in PlatformShell context.');
assert.ok(qcQueue.includes('No dockets are waiting for QC review.'), 'QC queue should use QC-specific empty copy.');
assert.ok(qcQueue.includes('Send back'), 'QC queue should keep compact correction action naming.');
assert.ok(qcQueue.includes('error=""'), 'QC queue should avoid duplicate top-level + table-level query errors.');

assert.ok(casesPage.includes('title="All Dockets"'), 'All Dockets should continue to expose oversight/list framing.');
assert.ok(casesPage.includes('All Dockets is your full oversight registry'), 'All Dockets copy should not describe a pull queue.');

assert.ok(css.includes('.queue-table th,'), 'Shared queue table class should exist in platform CSS.');
assert.ok(css.includes('.queue-action-group'), 'Shared queue action grouping class should exist in platform CSS.');
assert.ok(!css.includes('td:nth-child('), 'Queue table styles should avoid brittle nth-child selectors.');
assert.ok(css.includes('.queue-table .queue-cell-wrap'), 'Queue table wrapping should use explicit class selectors.');
assert.ok(!whatsNew.includes('Workbaskets, My Worklist, QC Worklist, and All Dockets'), 'Whats New scope should match actual queue pages polished in this PR.');

console.log('queuePagesPolish.test.mjs passed');
