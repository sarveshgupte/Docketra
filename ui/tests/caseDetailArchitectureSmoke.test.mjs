import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const detailSource = read('src/pages/CaseDetailPage.jsx');
const accessPolicySource = read('src/pages/caseDetail/caseDetailAccess.js');
const overviewPanelSource = read('src/pages/caseDetail/CaseDetailOverviewPanel.jsx');
const summaryHeaderSource = read('src/pages/caseDetail/CaseDetailSummaryHeader.jsx');
const alertsSource = read('src/pages/caseDetail/CaseDetailAlerts.jsx');

assert.ok(detailSource.includes('CaseDetailSummaryHeader'), 'Case detail should render a dedicated summary header module.');
assert.ok(detailSource.includes('CaseDetailOverviewPanel'), 'Case detail should render a dedicated overview/details module.');
assert.ok(detailSource.includes('CaseDetailAlerts'), 'Case detail should render dedicated alerts/status module.');
assert.ok(detailSource.includes('Loading message="Loading docket..."'), 'Case detail should preserve loading render state.');
assert.ok(detailSource.includes('<p>Docket not found</p>'), 'Case detail should preserve empty/not-found render state.');
assert.ok(accessPolicySource.includes('canRouteDocketByPolicy'), 'Permission checks should be explicit in reusable helpers.');
assert.ok(accessPolicySource.includes('canCloneDocketByPolicy'), 'Clone permission policy should be explicit and testable.');
assert.ok(overviewPanelSource.includes('aria-label="Docket actions"'), 'Overview module should preserve action surface rendering.');
assert.ok(summaryHeaderSource.includes('aria-label="Docket summary header"'), 'Summary module should preserve header rendering semantics.');
assert.ok(alertsSource.includes('Role Restricted Action'), 'Alerts module should preserve role restriction alerts.');

console.log('caseDetailArchitectureSmoke.test.mjs passed');

