import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const hookSource = read('src/hooks/useReportsDashboardQuery.js');
assert.ok(!hookSource.includes('placeholderData: emptyPayload'), 'Reports dashboard query must not seed empty placeholder data on initial load.');
assert.ok(!hookSource.includes('const emptyPayload'), 'Reports dashboard query should avoid empty placeholder payload constants.');

const pageSource = read('src/pages/reports/ReportsDashboard.jsx');
assert.ok(pageSource.includes('if (isLoading)'), 'Reports dashboard should show skeleton during initial loading state.');
assert.ok(pageSource.includes('if (isSuccess && !hasAnyReportData)'), 'Reports dashboard empty state must only render after successful real fetch with no data.');
assert.ok(pageSource.includes('if (error && !isSuccess)'), 'Reports dashboard should show error empty-state only for initial failed load.');
assert.ok(pageSource.includes('isFetching && hasAnyReportData'), 'Background refetch should keep existing report cards visible.');

console.log('reportsDashboardLoadingStates.test.mjs passed');
