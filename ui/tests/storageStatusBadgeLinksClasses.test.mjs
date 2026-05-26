import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const badge = read('ui/src/components/platform/StorageStatusBadge.jsx');

assert.ok(badge.includes('className="platform__storage-link platform__storage-link--primary"'), 'Storage Settings link should use primary storage link class');
assert.ok(badge.includes('className="platform__storage-link" to={dataStorageMapPath}'), 'Data Storage Map link should use storage link class');

console.log('storageStatusBadgeLinksClasses.test.mjs passed');
