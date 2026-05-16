import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uiRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(uiRoot, '..');

const resolvePath = (relFromUi) => {
  const fromUi = path.resolve(uiRoot, relFromUi);
  if (fs.existsSync(fromUi)) return fromUi;
  const fromRepo = path.resolve(repoRoot, 'ui', relFromUi);
  if (fs.existsSync(fromRepo)) return fromRepo;
  throw new Error(`Fixture not found: ${relFromUi}`);
};
const read = (relFromUi) => fs.readFileSync(resolvePath(relFromUi), 'utf8');

const storageService = read('src/services/storageService.js');
assert.ok(storageService.includes("new URL('storage/google/connect', `${API_BASE_URL}/`).toString()"), 'connectGoogleDrive should use API_BASE_URL for backend origin');
assert.ok(!storageService.includes("window.location.assign('/api/storage/google/connect')"), 'connectGoogleDrive should not use same-origin /api path');

const storagePage = read('src/pages/StorageSettingsPage.jsx');
assert.ok(storagePage.includes('Firm-owned Google Drive'), 'Storage settings should include dedicated Google OAuth card');
assert.ok(storagePage.includes('Connect firm Google Drive'), 'Storage settings should expose clear Google OAuth connect CTA');
assert.ok(storagePage.includes("onClick={connectGoogleDrive}"), 'Google OAuth CTA should call connectGoogleDrive directly');
assert.ok(storagePage.includes('Advanced manual providers'), 'OneDrive/S3 should be behind advanced manual section');
assert.ok(storagePage.includes('Storage capacity'), 'Storage settings should include storage capacity section');
assert.ok(storagePage.includes('Refresh usage'), 'Storage settings should provide usage refresh action');
assert.ok(storagePage.includes("providerParam === 'google-drive' && connected === '1'"), 'OAuth success params should trigger configuration refresh');
assert.ok(storagePage.includes('Google Drive connection was not completed. Docketra-managed storage is still active.'), 'OAuth error should show non-blocking fallback message');

assert.ok(storageService.includes("api.post('/storage/disconnect')"), 'disconnectStorage should POST /storage/disconnect');
assert.ok(storagePage.includes('Disconnect firm Google Drive'), 'Disconnect action should exist for connected firm Google Drive state');
assert.ok(storagePage.includes('Disconnect firm Google Drive? Future uploads will use Docketra-managed storage.'), 'Disconnect confirmation copy should be present');
assert.ok(storagePage.includes('onClick={connectGoogleDrive}'), 'Google OAuth connect remains direct and OTP-free');
assert.ok(storagePage.includes('Storage overview'), 'Storage overview should render at top of page');
assert.ok(storagePage.includes('Data storage map'), 'Storage settings should include data storage map section');
assert.ok(storagePage.includes('Backup and export'), 'Storage settings should include backup/export section');
assert.ok(storagePage.includes('Generate storage export'), 'Storage settings should include storage export action');
assert.ok(!storagePage.includes('Generate Firm Export'), 'Legacy duplicate export CTA should be removed');
assert.ok(!storagePage.includes('rootFolderId'), 'Storage settings page source should not expose rootFolderId');
assert.ok(!storagePage.includes('privateKey'), 'Storage settings page source should not expose privateKey');
assert.ok(!storagePage.includes('Connect / Refresh Google Drive'), 'Legacy mixed Google provider CTA copy should be removed');

const successPage = read('src/pages/StorageOAuthSuccessPage.jsx');
assert.ok(successPage.includes('/app/firm/'), 'Storage OAuth success page should redirect to firm-scoped storage settings route');

const protectedRoutes = read('src/routes/ProtectedRoutes.jsx');
assert.ok(protectedRoutes.includes('path="/storage/success"'), 'Protected routes should include /storage/success recovery route');

console.log('storageOauthFlow.test.mjs passed');
