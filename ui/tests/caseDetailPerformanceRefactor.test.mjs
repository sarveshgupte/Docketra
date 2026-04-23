import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const detailSource = read('src/pages/CaseDetailPage.jsx');
assert.ok(detailSource.includes('const CaseDetailAttachmentsPanel = lazy('), 'Attachments surface should be lazy-loaded.');
assert.ok(detailSource.includes('const CaseDetailActivityPanel = lazy('), 'Activity surface should be lazy-loaded.');
assert.ok(detailSource.includes('const CaseDetailHistoryPanel = lazy('), 'History surface should be lazy-loaded.');
assert.ok(detailSource.includes('if (activeTab !== CASE_DETAIL_TABS.ACTIVITY) return undefined;'), 'Timeline fetch should be deferred until Activity tab is opened.');
assert.ok(detailSource.includes('[CASE_DETAIL_TABS.OVERVIEW, CASE_DETAIL_TABS.HISTORY].includes(activeTab)'), 'Client docket history fetch should be scoped to Overview/History tabs.');
assert.ok(!detailSource.includes('ACTION_VISIBILITY_DEBUG'), 'Debug action-visibility log should be removed.');
assert.ok(!detailSource.includes('DOCKET_DEBUG'), 'Debug docket log should be removed.');

console.log('caseDetailPerformanceRefactor.test.mjs passed');
