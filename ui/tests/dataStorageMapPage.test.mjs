import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relPath) => fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');

const page = read('src/pages/DataStorageMapPage.jsx');
assert.ok(page.includes('Data Storage Map'));
assert.ok(page.includes('Your business data lives in your firm cloud storage. Docketra stores only control-plane metadata needed to run the app.'));
assert.ok(page.includes('MongoDB control-plane data'));

const routes = read('src/routes/ProtectedRoutes.jsx');
assert.ok(routes.includes('path="data-storage-map"'));
assert.ok(routes.includes('<ProtectedRoute requireAdmin>'));

console.log('dataStorageMapPage.test.mjs passed');
