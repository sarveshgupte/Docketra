import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const apiSource = read('src/api/docketraIntelligence.api.js');
const hookSource = read('src/hooks/usePlatformDataQueries.js');
const pageSource = read('src/pages/platform/DocketraIntelligencePage.jsx');
const cssSource = read('src/components/platform/platform.css');
const docsSource = fs.readFileSync(path.join(root, '..', 'docs/features/deadline-risk-intelligence.md'), 'utf8');

assert.ok(
  apiSource.includes("api.get('/docketra-intelligence/deadline-risk'"),
  'Frontend API should call deadline risk endpoint.'
);

assert.ok(
  hookSource.includes('usePlatformDeadlineRiskQuery') && hookSource.includes('platform:docketra-intelligence:deadline-risk'),
  'React Query hook should expose deadline risk intelligence.'
);

assert.ok(pageSource.includes('Deadline Risk Radar'), 'Dashboard should include Deadline Risk Radar widget.');
assert.ok(pageSource.includes('usePlatformDeadlineRiskQuery'), 'Dashboard should load deadline risk data.');
assert.ok(pageSource.includes('Risk Level'), 'Dashboard widget should display risk level.');
assert.ok(pageSource.includes('Recommendation'), 'Dashboard widget should display recommended action.');
assert.ok(pageSource.includes('awaiting review approval'), 'Dashboard widget should display review bottlenecks.');
assert.ok(pageSource.includes('Affected Dockets'), 'Dashboard widget should display affected dockets.');

for (const label of ['Low Risk', 'Medium Risk', 'High Risk', 'Critical']) {
  assert.ok(pageSource.includes(label) || docsSource.includes(label), `Deadline risk should support ${label}.`);
}

assert.ok(cssSource.includes('intelligence-deadline-card'), 'Dashboard should include deadline risk card styles.');
assert.ok(docsSource.includes('GET /api/docketra-intelligence/deadline-risk'), 'Docs should document the endpoint.');
assert.ok(docsSource.includes('Reassign work immediately.'), 'Docs should include critical recommendation example.');

console.log('deadlineRiskIntelligence.test.mjs passed');
