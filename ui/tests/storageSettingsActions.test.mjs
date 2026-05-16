import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uiRoot = path.resolve(__dirname, '..');

const page = fs.readFileSync(path.resolve(uiRoot, 'src/pages/StorageSettingsPage.jsx'), 'utf8');

assert.ok(page.includes('onOpenStorageFolder'), 'Storage settings should define Open folder action handler.');
assert.ok(page.includes('Folder link unavailable.'), 'Storage settings should show clear folder-link unavailable message.');
assert.ok(page.includes('onGenerateExport'), 'Storage settings should define export action handler.');
assert.ok(page.includes('Generate storage export'), 'Storage settings should render storage export action.');
assert.ok(page.includes('Connect firm Google Drive'), 'Storage settings should expose Google OAuth connect action.');
assert.ok(page.includes('onDisconnectGoogle'), 'Storage settings should define Google disconnect action.');

console.log('storageSettingsActions.test.mjs passed');
