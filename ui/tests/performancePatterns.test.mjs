import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const hooksSource = read('src/hooks/usePlatformDataQueries.js');
assert.ok(hooksSource.includes('useQuery({'), 'Platform data hooks should use React Query.');
for (const queryKey of [
  "['platform', 'dashboard-summary']",
  "['platform', 'my-worklist']",
  "['platform', 'workbench']",
  "['platform', 'qc-workbench']",
  "['platform', 'reports-metrics']",
]) {
  assert.ok(hooksSource.includes(queryKey), `Missing expected platform query key ${queryKey}`);
}
assert.ok(hooksSource.includes('placeholderData: keepPreviousData'), 'Platform hooks should preserve previous data during background refresh.');
assert.ok(hooksSource.includes('staleTime:'), 'Platform hooks should define stale-time behavior intentionally.');

const shellSource = read('src/components/platform/PlatformShell.jsx');
assert.ok(shellSource.includes('searchCacheRef'), 'Command center should cache repeated search terms.');
assert.ok(shellSource.includes('trackAsync('), 'Command center should instrument search requests.');
assert.ok(shellSource.includes('requestId !== searchRequestIdRef.current'), 'Command center should guard stale responses.');
assert.ok(shellSource.includes('window.setTimeout'), 'Command center should debounce query execution.');

const layoutSource = read('src/components/common/Layout.jsx');
assert.ok(layoutSource.includes('notificationFetchInFlightRef'), 'Notification loader should avoid overlapping fetches.');
assert.ok(layoutSource.includes('latestNotificationFetchRef'), 'Notification loader should track last fetch time to reduce poll/socket overlap.');
assert.ok(layoutSource.includes('trackAsync('), 'Notification loader should emit lightweight performance instrumentation.');

console.log('performancePatterns.test.mjs passed');
