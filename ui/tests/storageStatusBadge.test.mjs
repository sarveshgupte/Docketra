import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const badge = read('src/components/platform/StorageStatusBadge.jsx');
const hook = read('src/hooks/useStorageStatusSummary.js');
const shell = read('src/components/platform/PlatformShell.jsx');

assert.ok(shell.includes("import StorageStatusBadge from './StorageStatusBadge'"), 'PlatformShell should import StorageStatusBadge');
assert.ok(shell.includes('<StorageStatusBadge />'), 'PlatformShell should render StorageStatusBadge in firm shell');

for (const label of ['Firm-owned storage active', 'Docketra-managed storage', 'Storage needs attention', 'Strict firm-owned storage']) {
  assert.ok(hook.includes(label), `Hook should map badge label state: ${label}`);
}

assert.ok(badge.includes('Business files are stored in your firm-owned Google Drive.') || hook.includes('Business files are stored in your firm-owned Google Drive.'), 'Safe trust copy should be present for BYOS mode');
assert.ok(hook.includes('Google Drive root recovery required'), 'Badge mapping should mention root recovery in attention state');

for (const secretField of ['rootFolderId', 'driveId', 'refreshToken', 'accessToken', 'privateKey', 'clientSecret', 'credentials']) {
  assert.equal(badge.includes(secretField), false, `Badge component must not render secret field: ${secretField}`);
}

console.log('storageStatusBadge.test.mjs passed');
