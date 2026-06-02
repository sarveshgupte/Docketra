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
const docsSource = fs.readFileSync(path.join(root, '..', 'docs/features/workbasket-capacity-intelligence.md'), 'utf8');

assert.ok(
  apiSource.includes("api.get('/docketra-intelligence/workbasket-capacity'"),
  'Frontend API should call workbasket capacity endpoint.'
);

assert.ok(
  hookSource.includes('usePlatformWorkbasketCapacityQuery') && hookSource.includes('platform:docketra-intelligence:workbasket-capacity'),
  'React Query hook should expose workbasket capacity intelligence.'
);

assert.ok(pageSource.includes('Workbasket Health'), 'Dashboard should include Workbasket Health section.');
assert.ok(pageSource.includes('usePlatformWorkbasketCapacityQuery'), 'Dashboard should load workbasket capacity data.');
assert.ok(pageSource.includes('Capacity: {toNumber(workbasket.capacityUtilization)}%'), 'Dashboard cards should show capacity percentage.');

for (const label of ['Healthy', 'Busy', 'Overloaded']) {
  assert.ok(docsSource.includes(label), `Docs should describe ${label} state.`);
}

assert.ok(cssSource.includes('intelligence-workbasket-grid'), 'Dashboard should include workbasket health card grid styles.');
assert.ok(docsSource.includes('GET /api/docketra-intelligence/workbasket-capacity'), 'Docs should document the endpoint.');
assert.ok(docsSource.includes('busyThreshold') && docsSource.includes('overloadedThreshold'), 'Docs should document configurable thresholds.');

console.log('workbasketCapacityIntelligence.test.mjs passed');
