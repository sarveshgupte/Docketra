import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uiRoot = path.resolve(__dirname, '..');

const read = (relFromUi) => fs.readFileSync(path.resolve(uiRoot, relFromUi), 'utf8');

const settingsPage = read('src/pages/platform/SettingsPage.jsx');
const platformCss = read('src/components/platform/platform.css');

assert.ok(settingsPage.includes('title="Settings menu"'), 'Settings page should use concise Settings menu section title');
assert.ok(settingsPage.includes('className="panel settings-menu"'), 'Settings page should render one compact settings menu');
assert.ok(settingsPage.includes('className="settings-menu__item"'), 'Settings page rows should use settings-menu item class');

for (const label of ['General', 'Users & Team', 'Workbaskets', 'Categories', 'Storage', 'Storage Map']) {
  assert.ok(settingsPage.includes(`title: '${label}'`), `Settings page should include ${label} menu row`);
}

assert.ok(settingsPage.includes('ROUTES.FIRM_SETTINGS(firmSlug)'), 'Settings page should link firm settings route');
assert.ok(settingsPage.includes('ROUTES.WORK_SETTINGS(firmSlug)'), 'Settings page should link work settings route');
assert.ok(settingsPage.includes('ROUTES.ADMIN(firmSlug)'), 'Settings page should link admin/team route');
assert.ok(settingsPage.includes('ROUTES.WORK_CATEGORY_MANAGEMENT(firmSlug)'), 'Settings page should link category settings route');
assert.ok(settingsPage.includes('ROUTES.STORAGE_SETTINGS(firmSlug)'), 'Settings page should link storage settings route');
assert.ok(settingsPage.includes('ROUTES.DATA_STORAGE_MAP(firmSlug)'), 'Settings page should link storage map route');
assert.equal(settingsPage.includes('ROUTES.AI_SETTINGS(firmSlug)'), false, 'Settings page should not surface hidden AI settings in the concise menu');
assert.equal(settingsPage.includes('ROUTES.ADMIN_REPORTS(firmSlug)'), false, 'Settings page should not mix audit reports into the settings menu');

assert.ok(platformCss.includes('.settings-menu'), 'Platform CSS should define settings-menu');
assert.ok(platformCss.includes('.settings-menu__item'), 'Platform CSS should define settings-menu item rows');
assert.ok(platformCss.includes('.settings-menu__action'), 'Platform CSS should define row action affordance');

console.log('settingsPageLayout.test.mjs passed');
