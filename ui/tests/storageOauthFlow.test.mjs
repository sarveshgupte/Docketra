import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (rel) => fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8');

const storageService = read('ui/src/services/storageService.js');
assert.ok(storageService.includes("new URL('storage/google/connect', `${API_BASE_URL}/`).toString()"), 'connectGoogleDrive should use API_BASE_URL for backend origin');
assert.ok(!storageService.includes("window.location.assign('/api/storage/google/connect')"), 'connectGoogleDrive should not use same-origin /api path');

const storagePage = read('ui/src/pages/StorageSettingsPage.jsx');
assert.ok(storagePage.includes('Connect / Refresh Google Drive'), 'Storage settings should expose Google OAuth connect CTA');
assert.ok(storagePage.includes("providerParam === 'google-drive' && connected === '1'"), 'OAuth success params should trigger configuration refresh');

console.log('storageOauthFlow.test.mjs passed');
