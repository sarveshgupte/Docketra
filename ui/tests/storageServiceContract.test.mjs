import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uiRoot = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.resolve(uiRoot, 'src/services/storageService.js'), 'utf8');

assert.ok(
  source.includes("api.get('/storage/ownership-summary')"),
  'getStorageOwnershipSummary should call GET /storage/ownership-summary.',
);
assert.ok(
  source.includes("api.get('/storage/export')"),
  'exportFirmStorage should call GET /storage/export.',
);
assert.ok(
  source.includes("api.get('/storage/exports', { params: { limit } })"),
  'listStorageExports should call GET /storage/exports with limit params.',
);

console.log('storageServiceContract.test.mjs passed');
