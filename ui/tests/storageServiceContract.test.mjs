import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.resolve(process.cwd(), 'src/services/storageService.js'), 'utf8');

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
