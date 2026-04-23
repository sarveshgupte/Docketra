import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const scrollSource = read('src/components/routing/ScrollToTop.jsx');
assert.ok(scrollSource.includes('useNavigationType'), 'Scroll restoration should branch by navigation type.');
assert.ok(scrollSource.includes('SCROLL_CACHE_KEY'), 'Scroll restoration should use a route-scoped cache key.');
assert.ok(scrollSource.includes("navigationType === 'POP'"), 'Scroll restoration should restore state on browser back/forward.');

const casesSource = read('src/pages/CasesPage.jsx');
assert.ok(casesSource.includes('prefetchQuery({'), 'Cases page should prefetch docket detail for likely-open rows.');
assert.ok(casesSource.includes('onRowHover={handleCaseHover}'), 'Cases table should wire hover prefetch handler.');

const appSource = read('src/App.jsx');
assert.ok(appSource.includes('<RoutePerformanceTracker />'), 'App should mount route transition instrumentation tracker.');

const apiSource = read('src/services/api.js');
assert.ok(apiSource.includes('Duplicate API request in-flight'), 'API service should emit duplicate in-flight request diagnostics.');
assert.ok(apiSource.includes('Slow API response'), 'API service should emit slow-response diagnostics.');

console.log('performanceNavigationContinuity.test.mjs passed');
