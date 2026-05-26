import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const badge = read('ui/src/components/platform/StorageStatusBadge.jsx');
const css = read('ui/src/components/platform/platform.css');

assert.ok(badge.includes('className="platform__storage-link platform__storage-link--primary"'), 'Storage Settings link should use primary storage link class');
assert.ok(badge.includes('className="platform__storage-link" to={summary.dataStorageMapPath}'), 'Data Storage Map link should use storage link class');
assert.ok(css.includes('max-width: calc(100vw - 20px);'), 'Storage popover should use viewport-safe max-width.');
assert.ok(css.includes('overflow-wrap: anywhere;'), 'Storage content should wrap long text safely.');
assert.ok(css.includes('grid-template-columns: 130px minmax(0, 1fr);'), 'Storage metadata rows should constrain value column width.');
assert.ok(css.includes('.platform__storage-meta div { grid-template-columns: 1fr; gap: 3px; }'), 'Storage metadata should stack on narrow viewports.');

console.log('storageStatusBadgeLinksClasses.test.mjs passed');
