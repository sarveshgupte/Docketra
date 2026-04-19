import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const migratedPages = [
  { file: 'src/pages/ClientsPage.jsx', expectedTitle: 'title="Clients"' },
  { file: 'src/pages/ClientWorkspacePage.jsx', expectedTitle: 'title={client?.businessName || "Client workspace"}' },
  { file: 'src/pages/AdminPage.jsx', expectedTitle: 'title={isWorkSettingsContext ? "Category Management" : "Team"}' },
  { file: 'src/pages/FirmSettingsPage.jsx', expectedTitle: 'title="Firm settings"' },
  { file: 'src/pages/WorkSettingsPage.jsx', expectedTitle: 'title="Work settings"' },
  { file: 'src/pages/StorageSettingsPage.jsx', expectedTitle: 'title="Storage settings"' },
  { file: 'src/pages/AiSettingsPage.jsx', expectedTitle: 'title="AI settings"' },
];

for (const page of migratedPages) {
  const source = read(page.file);
  assert.ok(source.includes("import { PlatformShell }"), `${page.file} should import PlatformShell`);
  assert.equal(source.includes("import { Layout }"), false, `${page.file} should not import legacy Layout`);
  assert.ok(source.includes('<PlatformShell'), `${page.file} should render PlatformShell`);
  assert.equal(source.includes('<Layout'), false, `${page.file} should not render legacy Layout`);
  assert.ok(source.includes(page.expectedTitle), `${page.file} should define a coherent page title in PlatformShell`);
}

const clientsSource = read('src/pages/ClientsPage.jsx');
assert.ok(clientsSource.includes('title="Could not load clients"'), 'Clients page should show intentional error state title');
assert.ok(clientsSource.includes('actionLabel="Retry"'), 'Clients page should provide retry guidance for error recovery');

const routesSource = read('src/routes/ProtectedRoutes.jsx');
for (const route of ['path="clients"', 'path="admin"', 'path="settings/firm"', 'path="settings/work"', 'path="storage-settings"', 'path="ai-settings"']) {
  assert.ok(routesSource.includes(route), `Protected routes should keep migrated route registered: ${route}`);
}

console.log('firmWorkspaceShellUnification.test.mjs passed');
