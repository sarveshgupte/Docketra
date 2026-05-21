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

assert.ok(settingsPage.includes('title="Workspace settings"'), 'Settings page should use Workspace settings section title');
assert.ok(settingsPage.includes('className="settings-grid"'), 'Settings page should render settings-grid layout');
assert.ok(settingsPage.includes('className="panel settings-card"'), 'Settings page cards should use settings-card class');

assert.ok(settingsPage.includes('Firm profile'), 'Settings page should include Firm profile card');
assert.ok(settingsPage.includes('Work settings'), 'Settings page should include Work settings card');
assert.ok(settingsPage.includes('Team & controls'), 'Settings page should include Team & controls card');
assert.ok(settingsPage.includes('Open team & access'), 'Settings page should keep Open team & access CTA.');
assert.ok(settingsPage.includes('Storage & AI'), 'Settings page should include Storage & AI card');

assert.ok(settingsPage.includes('ROUTES.FIRM_SETTINGS(firmSlug)'), 'Settings page should link firm settings route');
assert.ok(settingsPage.includes('ROUTES.WORK_SETTINGS(firmSlug)'), 'Settings page should link work settings route');
assert.ok(settingsPage.includes('ROUTES.ADMIN(firmSlug)'), 'Settings page should link admin/team route');
assert.ok(settingsPage.includes('ROUTES.STORAGE_SETTINGS(firmSlug)'), 'Settings page should link storage settings route');
assert.ok(settingsPage.includes('ROUTES.AI_SETTINGS(firmSlug)'), 'Settings page should link AI settings route');
assert.ok(settingsPage.includes('ROUTES.ADMIN_REPORTS(firmSlug)'), 'Settings page should link audit reports route');

assert.ok(platformCss.includes('.settings-grid'), 'Platform CSS should define settings-grid');
assert.ok(platformCss.includes('.settings-card'), 'Platform CSS should define settings-card');
assert.ok(platformCss.includes('.settings-card__primary-action'), 'Platform CSS should pin primary action row');
assert.ok(platformCss.includes('.settings-card__related-links'), 'Platform CSS should define lighter secondary links');

console.log('settingsPageLayout.test.mjs passed');
