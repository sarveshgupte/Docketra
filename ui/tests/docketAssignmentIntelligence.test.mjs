import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const helperSource = read('src/components/docket/AssigneeIntelligence.jsx');
const workbasketsSource = read('src/pages/platform/WorkbasketsPage.jsx');
const worklistSource = read('src/pages/platform/WorklistPage.jsx');
const caseDetailSource = read('src/pages/CaseDetailPage.jsx');
const modalSource = read('src/pages/caseDetail/CaseWorkflowModals.jsx');
const hookSource = read('src/hooks/usePlatformDataQueries.js');
const docsSource = fs.readFileSync(path.join(root, '..', 'docs/features/docketra-intelligence-routing.md'), 'utf8');

assert.ok(
  hookSource.includes('usePlatformWorkloadIntelligenceQuery = (options = {}, queryOptions = {})'),
  'Workload query hook should accept query options so manager-only assignment screens can enable it safely.'
);

for (const source of [workbasketsSource, worklistSource, caseDetailSource]) {
  assert.ok(source.includes('usePlatformWorkloadIntelligenceQuery'), 'Assignment surface should call GET /api/docketra-intelligence/workload through the workload query hook.');
  assert.ok(source.includes('enrichAssignableUsersWithIntelligence'), 'Assignment surface should match assignees to workload members.');
  assert.ok(source.includes('getAssigneeOptionLabel'), 'Assignment surface should show workload indicators in assignee options.');
}

assert.match(
  helperSource,
  /right\.intelligence\.availabilityScore - left\.intelligence\.availabilityScore[\s\S]*left\.intelligence\.overdue - right\.intelligence\.overdue[\s\S]*left\.intelligence\.reviewQueue - right\.intelligence\.reviewQueue/,
  'Assignees should sort by Availability Score DESC, Overdue ASC, and Review Queue ASC.'
);

for (const label of ['Available', 'Moderate', 'Busy', 'Overloaded']) {
  assert.ok(helperSource.includes(label), `Assignee intelligence should support ${label} label.`);
}

for (const text of ['Availability', 'Open Dockets', 'Overdue', 'Recommended']) {
  assert.ok(helperSource.includes(text), `Assignee intelligence should display ${text}.`);
}

assert.ok(
  helperSource.includes('Recommendation is based on active workload, due dates, review commitments, estimated effort and actual effort.'),
  'Recommended assignee tooltip should explain the scoring basis.'
);

assert.ok(
  helperSource.includes('Manual assignment is still available') || helperSource.includes('Manual selection is not blocked'),
  'Intelligence failures or empty states should not block manual selection.'
);

assert.ok(
  modalSource.includes('AssigneeIntelligencePanel') && modalSource.includes('assigneeIntelligenceLoading') && modalSource.includes('assigneeIntelligenceError'),
  'Case Detail reassignment modal should render intelligence guidance and states.'
);

for (const section of ['Assignment Workflow', 'Assignee Indicators', 'Sorting', 'Recommendation Tooltip', 'Current UI Coverage']) {
  assert.ok(docsSource.includes(section), `Routing docs should include ${section}.`);
}

console.log('docketAssignmentIntelligence.test.mjs passed');
