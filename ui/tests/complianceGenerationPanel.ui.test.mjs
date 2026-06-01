import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const pageSource = fs.readFileSync(path.resolve('ui/src/pages/ComplianceCalendarPage.jsx'), 'utf8');
const apiSource = fs.readFileSync(path.resolve('ui/src/api/dashboard.api.js'), 'utf8');

assert.ok(pageSource.includes('Recurring Generation'), 'Compliance page should expose recurring generation panel.');
assert.ok(pageSource.includes('runComplianceGeneration'), 'Compliance page should call run generation API.');
assert.ok(pageSource.includes('previewComplianceGeneration'), 'Compliance page should call preview generation API.');
assert.ok(pageSource.includes('Skipped Duplicate'), 'Compliance page should show skipped duplicate badge.');

assert.ok(apiSource.includes('/dashboard/compliance-generation/preview'), 'Dashboard API should expose preview generation endpoint.');
assert.ok(apiSource.includes('/dashboard/compliance-generation/run'), 'Dashboard API should expose run generation endpoint.');

console.log('compliance generation panel UI contract passed');
