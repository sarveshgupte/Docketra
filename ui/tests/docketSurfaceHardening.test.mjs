import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const casesPage = read('src/pages/CasesPage.jsx');
assert.ok(casesPage.includes("from '../utils/docketSla'"), 'CasesPage should use shared docket SLA helpers.');
assert.ok(casesPage.includes('getDocketRecencyLabel'), 'CasesPage should consume shared recency labeling helper.');

const caseDetailPage = read('src/pages/CaseDetailPage.jsx');
assert.ok(caseDetailPage.includes('useDocketQueueNavigation'), 'CaseDetail should centralize queue return context in a dedicated hook.');
assert.ok(caseDetailPage.includes('CaseWorkflowModals'), 'CaseDetail should delegate workflow modals into a decomposed component.');
assert.ok(caseDetailPage.includes('routeSubmitting'), 'CaseDetail routing workflow should expose per-action loading state.');
assert.ok(caseDetailPage.includes('if (qcSubmitting) return;'), 'CaseDetail QC action should guard against duplicate submission.');

const queueHook = read('src/hooks/useDocketQueueNavigation.js');
assert.ok(queueHook.includes('isFirmAppRoute'), 'Queue navigation hook should sanitize returnTo route context.');
assert.ok(queueHook.includes('getNavigationState'), 'Queue navigation hook should provide stable prev/next context state.');

const workflowModals = read('src/pages/caseDetail/CaseWorkflowModals.jsx');
assert.ok(workflowModals.includes('Route Docket to Workbasket'), 'Workflow modal component should include route action UI.');
assert.ok(workflowModals.includes('Submit QC Action'), 'Workflow modal component should preserve QC action UI.');

console.log('docketSurfaceHardening.test.mjs passed');
