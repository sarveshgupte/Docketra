import fs from 'fs';
import path from 'path';
import assert from 'assert';

const page = fs.readFileSync(path.resolve(process.cwd(), 'ui/src/pages/CaseDetailPage.jsx'), 'utf8');
const modals = fs.readFileSync(path.resolve(process.cwd(), 'ui/src/pages/caseDetail/CaseWorkflowModals.jsx'), 'utf8');
const overview = fs.readFileSync(path.resolve(process.cwd(), 'ui/src/pages/caseDetail/CaseDetailOverviewPanel.jsx'), 'utf8');

assert.ok(page.includes("label: 'Submit'"), 'Routed receiving user should see Submit action');
assert.ok(modals.includes('Submit Routed Docket'), 'Submit modal title should be explicit');
assert.ok(modals.includes('does not finally resolve the docket'), 'Submit helper text should avoid resolve semantics');
assert.ok(overview.includes('showFileAction'), 'File button should be controllable/hidden for routed receiving users');
assert.ok(overview.includes("['resolve', 'submit'].includes(action.key)"), 'Primary action row should prioritize resolve/submit.');
assert.ok(page.includes("String(team?.type || '').toUpperCase() === 'PRIMARY'"), 'Route dropdown should filter PRIMARY only');

console.log('case detail route submit visibility checks passed');
