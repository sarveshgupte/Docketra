import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uiRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(uiRoot, '..');

const resolvePath = (relFromUi) => {
  const fromUi = path.resolve(uiRoot, relFromUi);
  if (fs.existsSync(fromUi)) return fromUi;
  const fromRepo = path.resolve(repoRoot, 'ui', relFromUi);
  if (fs.existsSync(fromRepo)) return fromRepo;
  throw new Error(`Fixture not found: ${relFromUi}`);
};
const read = (relFromUi) => fs.readFileSync(resolvePath(relFromUi), 'utf8');

const page = read('src/pages/DataStorageMapPage.jsx');
assert.ok(page.includes('Data Storage Map'));
assert.ok(
  page.includes('Your business data lives in your firm cloud storage. DocketsHQ stores only control-plane metadata needed to run the app.') ||
  page.includes('Your business data lives in your firm cloud storage. Docketra stores only control-plane metadata needed to run the app.')
);
assert.ok(page.includes('MongoDB control-plane data'));

const routes = read('src/routes/ProtectedRoutes.jsx');
assert.ok(routes.includes('path="data-storage-map"'));
assert.ok(routes.includes('<ProtectedRoute requireAdmin>'));

console.log('dataStorageMapPage.test.mjs passed');
