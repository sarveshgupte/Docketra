import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const badge = read('ui/src/components/platform/StorageStatusBadge.jsx');
const routes = read('ui/src/constants/routes.js');
const protectedRoutes = read('ui/src/routes/ProtectedRoutes.jsx');

assert.ok(badge.includes('className="platform__storage-link platform__storage-link--primary"'), 'Storage Settings link should use primary storage link class');
assert.ok(badge.includes('className="platform__storage-link" to={dataStorageMapPath}'), 'Data Storage Map link should use storage link class');
assert.ok(badge.includes('ROUTES.STORAGE_SETTINGS(activeFirmSlug)'), 'Storage Settings path should fall back to current firm slug route.');
assert.ok(badge.includes('ROUTES.DATA_STORAGE_MAP(activeFirmSlug)'), 'Data Storage Map path should fall back to current firm slug route.');

assert.ok(badge.includes('to={storageSettingsPath} onClick={() => setOpen(false)}'), 'Storage Settings link should close popover on click and use Link target.');
assert.ok(badge.includes('to={dataStorageMapPath} onClick={() => setOpen(false)}'), 'Data Storage Map link should close popover on click and use Link target.');
assert.match(routes, /STORAGE_SETTINGS:\s*\(firmSlug\)\s*=>\s*`\/app\/firm\/\$\{firmSlug\}\/storage-settings`/, 'Storage Settings route helper should match registered path.');
assert.match(routes, /DATA_STORAGE_MAP:\s*\(firmSlug\)\s*=>\s*`\/app\/firm\/\$\{firmSlug\}\/data-storage-map`/, 'Data Storage Map route helper should match registered path.');
assert.ok(protectedRoutes.includes('path="storage-settings"'), 'Storage Settings route should be registered in protected routes.');
assert.ok(protectedRoutes.includes('path="data-storage-map"'), 'Data Storage Map route should be registered in protected routes.');
const css = read('ui/src/components/platform/platform.css');

assert.ok(badge.includes('className="platform__storage-link platform__storage-link--primary"'), 'Storage Settings link should use primary storage link class');
assert.ok(badge.includes('className="platform__storage-link" to={dataStorageMapPath}'), 'Data Storage Map link should use storage link class');
assert.ok(badge.includes('ROUTES.DATA_STORAGE_MAP(activeFirmSlug)'), 'Data Storage Map link should use the current firm slug fallback.');
assert.ok(css.includes('max-width: calc(100vw - 20px);'), 'Storage popover should use viewport-safe max-width.');
assert.ok(css.includes('overflow-wrap: anywhere;'), 'Storage content should wrap long text safely.');
assert.ok(css.includes('grid-template-columns: 130px minmax(0, 1fr);'), 'Storage metadata rows should constrain value column width.');
assert.ok(css.includes('.platform__storage-meta div { grid-template-columns: 1fr; gap: 3px; }'), 'Storage metadata should stack on narrow viewports.');

console.log('storageStatusBadgeLinksClasses.test.mjs passed');
