import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const sharedSource = read('src/pages/platform/PlatformShared.jsx');
const cssSource = read('src/components/platform/platform.css');
const shellSource = read('src/components/platform/PlatformShell.jsx');

for (const primitive of ['PageSection', 'DataTable', 'EmptyState', 'ErrorState', 'LoadingState', 'FilterBar', 'StatGrid', 'StatusMessageStack']) {
  assert.ok(sharedSource.includes(`export const ${primitive}`), `PlatformShared should export ${primitive}.`);
}

for (const layoutClass of ['.platform-page', '.section-group', '.layout-two-col', '.layout-two-by-two', '.card-deck', '.form-split', '.action-row--tight', '.secondary-link', '.table-wrap--compact']) {
  assert.ok(cssSource.includes(layoutClass), `platform.css should include ${layoutClass}.`);
}

for (const propContract of ['loading = false', 'emptyLabel =', 'error,', 'onRetry,', 'paginationLabel =', 'pageSize =']) {
  assert.ok(sharedSource.includes(propContract), `DataTable should preserve ${propContract} contract.`);
}

for (const page of [
  'src/pages/platform/DashboardPage.jsx',
  'src/pages/platform/TaskManagerPage.jsx',
  'src/pages/platform/SettingsPage.jsx',
  'src/pages/FirmSettingsPage.jsx',
]) {
  const source = read(page);
  assert.ok(source.includes('<PlatformShell'), `${page} should keep PlatformShell as root shell.`);
  assert.equal(source.includes('style={{ margin'), false, `${page} should avoid inline margin layout styles.`);
  assert.equal(source.includes('style={{ padding'), false, `${page} should avoid inline padding layout styles.`);
}

assert.ok(shellSource.includes('export const PlatformShell'), 'PlatformShell should remain available for major workspace pages.');

console.log('platformDesignSystemHardening.test.mjs passed');
