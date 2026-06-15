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
const whatsNewHeadingCount = (whatsNew.match(/^# What's New$/gm) || []).length;
const dailyOpsEntryCount = (whatsNew.match(/^## 2026-05-21 — Reworked Daily Operations navigation$/gm) || []).length;

assert.ok(workbaskets.includes('moduleLabel="Queues"'), 'Workbaskets should render in the shared queue shell context.');
assert.ok(workbaskets.includes("selectedWorkbasket ? `Workbaskets — ${selectedWorkbasket.name}` : 'Workbaskets'"), 'Workbaskets should keep the shorter header title.');
assert.ok(workbaskets.includes('No dockets are waiting in your workbaskets.'), 'Workbaskets should use queue-specific empty copy.');
assert.ok(workbaskets.includes('subtitle="Shared queue."'), 'Workbaskets should keep the header copy short.');
assert.ok(workbaskets.includes('New docket'), 'Workbaskets should keep the primary action concise.');
assert.ok(workbaskets.includes('tableClassName="w-full text-left border-collapse"'), 'Workbaskets should keep the shared table styling.');
assert.ok(workbaskets.includes('error=""'), 'Workbaskets should avoid duplicate top-level + table-level query errors.');

assert.ok(worklist.includes("title={scopedWorkbasket ? `Worklist — ${scopedWorkbasket.name}` : 'My Worklist'}"), 'Worklist title should support scoped and fallback variants.');
assert.ok(worklist.includes('subtitle="Active queue."'), 'My Worklist should keep the header copy short.');
assert.ok(worklist.includes('Show active dockets only'), 'My Worklist should keep the compact status toggle.');
assert.ok(worklist.includes('error=""'), 'My Worklist should suppress duplicate table-level errors.');
assert.ok(worklist.includes('New docket'), 'My Worklist should keep the primary action concise.');
assert.equal(worklist.includes('<option value=\"IN_QC\">In QC</option>'), false, 'Normal worklist status filter should not include In QC.');

assert.ok(qcQueue.includes('moduleLabel="Queues"'), 'QC queue should render in the shared queue shell context.');
assert.ok(qcQueue.includes("selectedQcWorkbasket ? `QC Workbaskets — ${selectedQcWorkbasket.name}` : 'QC Workbaskets'"), 'QC queue should keep the shorter header title.');
assert.ok(qcQueue.includes('No dockets are waiting for QC review.'), 'QC queue should use QC-specific empty copy.');
assert.ok(qcQueue.includes('Send back'), 'QC queue should keep compact correction action naming.');
assert.ok(qcQueue.includes('subtitle="Review queue."'), 'QC queue should keep the header copy short.');
assert.ok(qcQueue.includes('error=""'), 'QC queue should avoid duplicate top-level + table-level query errors.');

assert.ok(casesPage.includes('title="All Dockets"'), 'All Dockets should continue to expose oversight/list framing.');
assert.ok(casesPage.includes('All Dockets is your full oversight registry'), 'All Dockets copy should not describe a pull queue.');

assert.ok(css.includes('.queue-table th,'), 'Shared queue table class should exist in platform CSS.');
assert.ok(css.includes('.queue-action-group'), 'Shared queue action grouping class should exist in platform CSS.');
assert.ok(!css.includes('td:nth-child('), 'Queue table styles should avoid brittle nth-child selectors.');
assert.ok(css.includes('.queue-table .queue-cell-wrap'), 'Queue table wrapping should use explicit class selectors.');
assert.ok(!whatsNew.includes('Workbaskets, My Worklist, QC Worklist, and All Dockets'), 'Whats New scope should match actual queue pages polished in this PR.');
assert.equal(whatsNewHeadingCount, 1, "What's New should contain exactly one top-level heading.");
assert.equal(dailyOpsEntryCount, 1, 'Daily Operations What\'s New entry should appear exactly once.');

console.log('queuePagesPolish.test.mjs passed');
