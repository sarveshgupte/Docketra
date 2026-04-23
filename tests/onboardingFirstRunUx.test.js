const assert = require('assert');
const fs = require('fs');
const path = require('path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

const platformDashboard = read('ui/src/pages/platform/DashboardPage.jsx');
assert(platformDashboard.includes('First-run setup guidance'), 'Dashboard should render first-run setup guidance section');
assert(platformDashboard.includes('Setup blockers to clear'), 'Dashboard should render blocker guidance section');

const queuePages = [
  ['ui/src/pages/platform/WorkbasketsPage.jsx', 'What this queue is for', 'No dockets are in Workbench yet'],
  ['ui/src/pages/platform/WorklistPage.jsx', 'What this queue is for', 'No dockets are assigned to you yet'],
  ['ui/src/pages/platform/QcQueuePage.jsx', 'What this queue is for', 'No dockets are waiting for QC right now'],
];

for (const [file, heading, emptyCopy] of queuePages) {
  const source = read(file);
  assert(source.includes(heading), `${file} should explain queue purpose`);
  assert(source.includes(emptyCopy), `${file} should include actionable empty-state copy`);
}

const createForm = read('ui/src/components/docket/GuidedDocketForm.jsx');
assert(createForm.includes('First docket guidance'), 'Create docket flow should include first docket guidance');
assert(createForm.includes('Docket creation may be blocked'), 'Create docket flow should explain setup blockers');

const onboardingDoc = read('docs/product/first-run-onboarding.md');
assert(onboardingDoc.includes('First-run sequence by role'), 'First-run onboarding doc should describe role-based sequence');
assert(onboardingDoc.includes('Onboarding blocker presentation rules'), 'First-run onboarding doc should include blocker guidance');

console.log('onboarding first-run UX guardrails checks passed');
