const assert = require('assert');
const fs = require('fs');
const path = require('path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

const platformShared = read('ui/src/pages/platform/PlatformShared.jsx');
assert(platformShared.includes('emptyLabelFiltered'), 'DataTable should support filtered empty labels');
assert(platformShared.includes('onRetry'), 'DataTable should support retry action');
assert(platformShared.includes('RefreshNotice'), 'PlatformShared should expose background refresh notice');

const queuePages = [
  'ui/src/pages/platform/WorklistPage.jsx',
  'ui/src/pages/platform/WorkbasketsPage.jsx',
  'ui/src/pages/platform/QcQueuePage.jsx',
  'ui/src/pages/platform/CrmPage.jsx',
  'ui/src/pages/platform/CmsPage.jsx',
  'ui/src/pages/platform/ReportsPage.jsx',
];

for (const page of queuePages) {
  const source = read(page);
  assert(source.includes('RefreshNotice'), `${page} should use non-blocking refresh notice`);
  assert(source.includes('onRetry'), `${page} should provide table retry affordance`);
}

const aiSettings = read('ui/src/pages/AiSettingsPage.jsx');
assert(aiSettings.includes('Retry loading'), 'AI settings should provide retry affordance for load failures');
assert(aiSettings.includes('statusMessage'), 'AI settings should provide inline mutation status message');

const storageSettings = read('ui/src/pages/StorageSettingsPage.jsx');
assert(storageSettings.includes('Retry loading'), 'Storage settings should provide retry affordance for load failures');
assert(storageSettings.includes('statusMessage'), 'Storage settings should provide inline mutation status message');

const workSettings = read('ui/src/pages/WorkSettingsPage.jsx');
assert(workSettings.includes('statusMessage'), 'Work settings should provide inline mutation status message');
assert(workSettings.includes('Could not create the workbasket'), 'Work settings should provide actionable mutation failure copy');

console.log('ui async feedback consistency checks passed');
