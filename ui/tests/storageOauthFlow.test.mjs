import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (rel) => fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8');

const storageService = read('ui/src/services/storageService.js');
assert.ok(storageService.includes("new URL('storage/google/connect', `${API_BASE_URL}/`).toString()"), 'connectGoogleDrive should use API_BASE_URL for backend origin');
assert.ok(!storageService.includes("window.location.assign('/api/storage/google/connect')"), 'connectGoogleDrive should not use same-origin /api path');

const storagePage = read('ui/src/pages/StorageSettingsPage.jsx');
assert.ok(storagePage.includes('Firm-owned Google Drive (optional)'), 'Storage settings should include dedicated Google OAuth card');
assert.ok(storagePage.includes('Connect firm Google Drive'), 'Storage settings should expose clear Google OAuth connect CTA');
assert.ok(storagePage.includes("onClick={connectGoogleDrive}"), 'Google OAuth CTA should call connectGoogleDrive directly');
assert.ok(storagePage.includes('Advanced manual storage providers'), 'OneDrive/S3 should be behind advanced manual section');
assert.ok(storagePage.includes('Default: Docketra-managed Google Drive'), 'Storage settings should show managed default fallback');
assert.ok(storagePage.includes('Storage capacity'), 'Storage settings should include storage capacity section');
assert.ok(storagePage.includes('Refresh usage'), 'Storage settings should provide usage refresh action');
assert.ok(storagePage.includes("providerParam === 'google-drive' && connected === '1'"), 'OAuth success params should trigger configuration refresh');
assert.ok(storagePage.includes('Google Drive connection was not completed. Docketra-managed storage is still active.'), 'OAuth error should show non-blocking fallback message');

assert.ok(storageService.includes("api.post('/storage/disconnect')"), 'disconnectStorage should POST /storage/disconnect');
assert.ok(storagePage.includes('Disconnect firm Google Drive'), 'Disconnect action should exist for connected firm Google Drive state');
assert.ok(storagePage.includes('Disconnect firm Google Drive? Future uploads will use Docketra-managed storage.'), 'Disconnect confirmation copy should be present');
assert.ok(storagePage.includes('onClick={connectGoogleDrive}'), 'Google OAuth connect remains direct and OTP-free');
assert.ok(!storagePage.includes('Connect / Refresh Google Drive'), 'Legacy mixed Google provider CTA copy should be removed');

const successPage = read('ui/src/pages/StorageOAuthSuccessPage.jsx');
assert.ok(successPage.includes('/app/firm/'), 'Storage OAuth success page should redirect to firm-scoped storage settings route');

const protectedRoutes = read('ui/src/routes/ProtectedRoutes.jsx');
assert.ok(protectedRoutes.includes('path="/storage/success"'), 'Protected routes should include /storage/success recovery route');

console.log('storageOauthFlow.test.mjs passed');
