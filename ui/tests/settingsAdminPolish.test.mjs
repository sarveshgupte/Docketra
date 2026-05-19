import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relPath) => fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');

const settingsHub = read('src/pages/platform/SettingsPage.jsx');
assert.equal((settingsHub.match(/className="panel settings-card"/g) || []).length, 4, 'Settings hub should keep 4 settings cards');

const firmSettings = read('src/pages/FirmSettingsPage.jsx');
assert.ok(firmSettings.includes('StatusMessageStack'), 'Firm settings should use StatusMessageStack for feedback');
assert.ok(firmSettings.includes('You do not have permission to view admin activity.'), 'Firm settings should keep 403-specific admin activity message');

const workSettings = read('src/pages/WorkSettingsPage.jsx');
assert.ok(workSettings.includes('Use Work Settings to control how new dockets enter team queues.'), 'Work settings should include queue-routing helper copy');
assert.ok(workSettings.includes('ROUTES.WORK_CATEGORY_MANAGEMENT(firmSlug)'), 'Work settings should preserve category-management routing reference');

const adminPage = read('src/pages/AdminPage.jsx');
assert.ok(adminPage.includes('PlatformShell'), 'Team & Access surface should remain in PlatformShell');
assert.ok(adminPage.includes('AdminUsersSection'), 'Team & Access should preserve team members section');

const storagePage = read('src/pages/StorageSettingsPage.jsx');
assert.ok(storagePage.includes('firm’s own Google Drive'), 'Storage settings should preserve BYOS-first messaging');
assert.ok(!storagePage.includes('value={s3SecretAccessKey} readOnly'), 'Storage settings should not expose persisted secret values read-only');

const aiPage = read('src/pages/AiSettingsPage.jsx');
assert.ok(aiPage.includes('AI is optional.'), 'AI settings should explicitly describe AI as optional');
assert.ok(aiPage.includes('type="password"'), 'AI settings should keep API key entry masked');

const platformCss = read('src/components/platform/platform.css');
for (const cls of ['.settings-form-split', '.settings-action-bar', '.settings-status-card']) {
  assert.ok(platformCss.includes(cls), `${cls} helper class should exist`);
}

console.log('settingsAdminPolish.test.mjs passed');
