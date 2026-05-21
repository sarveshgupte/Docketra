import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const worklistPage = read('ui/src/pages/platform/WorklistPage.jsx');
const platformCss = read('ui/src/components/platform/platform.css');
const queryHook = read('ui/src/hooks/usePlatformDataQueries.js');

assert.ok(worklistPage.includes('className="filter-bar__checkbox"'), 'My Worklist checkbox should use compact filter checkbox class.');
assert.ok(platformCss.includes('.filter-bar__checkbox input[type="checkbox"]'), 'Platform filter bar should define checkbox-specific sizing.');
assert.ok(platformCss.includes('.filter-bar input:not([type="checkbox"]):not([type="radio"])'), 'Filter bar text input styles should not apply to checkbox/radio inputs.');

assert.ok(worklistPage.includes('We couldn’t load your assigned dockets. Refresh the page or contact your admin if this continues.'), 'My Worklist should show a helpful error message.');
assert.ok(worklistPage.includes('error=""'), 'DataTable duplicate error state should be suppressed in My Worklist.');

assert.ok(queryHook.includes('if (Array.isArray(payload?.data)) return payload.data;'), 'My Worklist query should normalize data arrays from payload.data.');
assert.ok(queryHook.includes('if (Array.isArray(payload?.items)) return payload.items;'), 'My Worklist query should normalize data arrays from payload.items.');
assert.ok(queryHook.includes('if (Array.isArray(payload)) return payload;'), 'My Worklist query should normalize top-level array responses.');

console.log('platformWorklistResilience.test.mjs passed');

const worklistView = read('ui/views/WorklistView.jsx');
assert.ok(worklistView.includes('Array.isArray(payload?.records)'), 'WorklistView should normalize payload.records responses.');
assert.ok(worklistView.includes('Array.isArray(payload?.items)'), 'WorklistView should normalize payload.items responses.');
assert.ok(worklistView.includes('Array.isArray(response?.records)'), 'WorklistView should normalize top-level response.records responses.');
assert.ok(worklistView.includes('|| payload?.pagination'), 'WorklistView should read pagination from payload pagination.');
