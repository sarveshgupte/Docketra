import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const uiRoot = path.resolve(testDir, '..');
const read = (relativePath) => fs.readFileSync(path.resolve(uiRoot, relativePath), 'utf8');

const badge = read('src/components/platform/StorageStatusBadge.jsx');
const hook = read('src/hooks/useStorageStatusSummary.js');
const summaryLogic = read('src/hooks/storageStatusSummaryLogic.js');
const storageSummarySource = `${hook}\n${summaryLogic}`;
const shell = read('src/components/platform/PlatformShell.jsx');

assert.ok(shell.includes("import StorageStatusBadge from './StorageStatusBadge'"), 'PlatformShell should import StorageStatusBadge');
assert.ok(shell.includes('<StorageStatusBadge />'), 'PlatformShell should render StorageStatusBadge in firm shell');
assert.ok(shell.includes('canViewStorageStatus ? <div className="platform__action-status"><StorageStatusBadge /></div> : null'), 'PlatformShell should hide StorageStatusBadge for roles below manager.');
assert.ok(shell.includes("hasFirmRoleAtLeast(role, 'MANAGER')"), 'Storage status visibility should be manager-or-above only.');
assert.ok(badge.includes("hasFirmRoleAtLeast(user, 'MANAGER')"), 'StorageStatusBadge should defensively gate regular users.');
assert.ok(hook.includes('ownershipSummary?.activeStorage'), 'Storage status summary should read nested activeStorage ownership data.');
assert.ok(hook.includes('Promise.allSettled'), 'Storage status summary should not let optional endpoint failures poison the badge state.');
assert.ok(hook.includes('bypassCache = false'), 'Storage status summary hook should support bypassing stale cache.');
assert.ok(badge.includes("includes('/storage-settings')"), 'Storage settings route should bypass cached shell badge status.');
assert.ok(badge.includes('bypassCache,'), 'StorageStatusBadge should pass cache bypass option into the summary hook.');

for (const label of ['Firm-owned storage active', 'Docketra-managed storage', 'Storage needs attention', 'Strict firm-owned storage']) {
  assert.ok(storageSummarySource.includes(label), `Hook should map badge label state: ${label}`);
}

assert.ok(badge.includes('Business files are stored in your firm-owned Google Drive.') || storageSummarySource.includes('Business files are stored in your firm-owned Google Drive.'), 'Safe trust copy should be present for BYOS mode');
assert.ok(storageSummarySource.includes('Google Drive root recovery required'), 'Badge mapping should mention root recovery in attention state');

for (const secretField of ['rootFolderId', 'driveId', 'refreshToken', 'accessToken', 'privateKey', 'clientSecret', 'credentials']) {
  assert.equal(badge.includes(secretField), false, `Badge component must not render secret field: ${secretField}`);
}

console.log('storageStatusBadge.test.mjs passed');
