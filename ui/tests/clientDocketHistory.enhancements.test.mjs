import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const read = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const historyPanel = read('src/pages/caseDetail/CaseDetailHistoryPanel.jsx');
const historyHook = read('src/pages/caseDetail/useClientDocketHistory.js');

assert.ok(historyPanel.includes('Loading client docket history…'), 'History panel should expose loading message.');
assert.ok(historyPanel.includes('Client docket history could not be loaded.'), 'History panel should expose error message.');
assert.ok(historyPanel.includes('No other dockets found for this client.'), 'History panel should expose empty-state message.');
assert.ok(historyPanel.includes('Category'), 'History panel should include Category column.');
assert.ok(historyPanel.includes('Subcategory'), 'History panel should include Subcategory column.');
assert.ok(historyPanel.includes('Status / Lifecycle'), 'History panel should include Status/Lifecycle column.');
assert.ok(historyPanel.includes('Closed/Resolved/Filed Date'), 'History panel should include closed/resolved/filed date column.');
assert.ok(historyPanel.includes('Assigned To / Owner'), 'History panel should include assignee/owner column.');
assert.ok(historyPanel.includes('Workbasket / Queue'), 'History panel should include queue/workbasket column.');
assert.ok(historyPanel.includes('aria-label="Past dockets for this client"'), 'History panel table should be accessible.');
assert.ok(historyPanel.includes('formatDocketId(row.docketId)'), 'History panel should format docket IDs.');
assert.ok(historyPanel.includes('LifecycleBadge'), 'History panel should use lifecycle badge when recognized.');
assert.ok(historyPanel.includes('View'), 'History panel should include action column for navigation.');
assert.ok(historyHook.includes('clientDocketsError'), 'History hook should return an explicit error state.');
assert.ok(historyHook.includes('resolveDocketId'), 'History hook should normalize docket IDs for exclusions.');

console.log('clientDocketHistory.enhancements.test.mjs passed');
