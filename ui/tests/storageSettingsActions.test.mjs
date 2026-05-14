import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/StorageSettingsPage.jsx'), 'utf8');

assert.ok(source.includes('onOpenStorageFolder'), 'Storage settings page should define open-folder action handler.');
assert.ok(source.includes("disabled={!folderLinkAvailable || openingFolder}"), 'Open folder button should be disabled when unavailable/loading.');
assert.ok(source.includes("openingFolder ? 'Opening…' : 'Open storage folder'"), 'Open folder action should show loading label.');
assert.ok(source.includes("exporting ? 'Generating…' : 'Generate storage export'"), 'Export action should show loading state.');
assert.ok(source.includes('Folder link unavailable.'), 'Storage settings should surface folder-link unavailable message.');

console.log('storageSettingsActions.test.mjs passed');
