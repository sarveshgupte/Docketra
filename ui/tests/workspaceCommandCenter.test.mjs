import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const shellSource = read('src/components/platform/PlatformShell.jsx');
const paletteSource = read('src/components/common/CommandPalette.jsx');
const shortcutsSource = read('src/utils/keyboardShortcuts.js');
const packageSource = read('package.json');

assert.ok(shellSource.includes("Search dockets, clients, modules…"), 'Topbar should expose command-center search scope hint');
assert.ok(shellSource.includes('Ctrl/⌘ K'), 'Trigger should use cross-platform shortcut copy');
assert.ok(shellSource.includes('isShortcutAllowedTarget(event.target)'), 'Platform shell should enforce typing target guard for all global shortcuts');
assert.ok(shellSource.includes("modifierPressed && key === 'k'"), 'Platform shell should own Cmd/Ctrl+K shortcut');
assert.ok(shellSource.includes("if (key === '/'"), 'Workspace should support quick open slash shortcut');
assert.ok(shellSource.includes('event.altKey && event.shiftKey'), 'Workspace should support collision-safe Alt+Shift route shortcuts');
assert.ok(shellSource.includes('searchRequestIdRef'), 'Search should use stale-response protection state');
assert.ok(shellSource.includes('if (!commandPaletteOpen)'), 'Search should not run while command center is closed');
assert.ok(shellSource.includes('setSearchError('), 'Search should expose fallback error state');
assert.ok(shellSource.includes('resetCommandCenterState'), 'Close behavior should reset query/results/searching state');
assert.ok(shellSource.includes('closeCommandPalette()'), 'Palette close should be centralized for consistent cleanup');
assert.ok(shellSource.includes('normalizeClientRows'), 'Client IDs should be normalized before route mapping');

for (const requiredCommand of [
  "'New Docket'",
  "'Go to Dashboard'",
  "'Go to Task Manager'",
  "'Go to CRM'",
  "'Go to CMS'",
  "'Go to Workbasket'",
  "'Go to My Worklist'",
  "'Go to QC Queue'",
  "'Go to Clients'",
  "'Go to Reports'",
  "'Go to Settings'",
  "'Open Profile'",
  "'Sign out'",
]) {
  assert.ok(shellSource.includes(requiredCommand), `Command center should contain required command: ${requiredCommand}`);
}

assert.equal(paletteSource.includes('window.addEventListener'), false, 'CommandPalette should not register global keyboard listeners');
assert.ok(paletteSource.includes('role="combobox"'), 'CommandPalette should expose combobox semantics');
assert.ok(paletteSource.includes('role="listbox"'), 'CommandPalette should expose listbox semantics');
assert.ok(paletteSource.includes("event.key === 'Escape'"), 'CommandPalette should support reliable Escape close behavior');
assert.ok(paletteSource.includes("event.key === 'Enter'"), 'CommandPalette should execute active item with Enter');
assert.ok(paletteSource.includes('setActiveIndex(0)'), 'CommandPalette should reset active index when closed');

assert.ok(shortcutsSource.includes('isEditableTarget'), 'Shared keyboard helper should define editable-target detection');
assert.ok(shortcutsSource.includes('input') && shortcutsSource.includes('textarea') && shortcutsSource.includes('select'), 'Editable target detection should include all core form controls');

assert.ok(packageSource.includes('"test:command-center": "node tests/workspaceCommandCenter.test.mjs"'), 'UI package scripts should include command center test entry');

const dashboardSource = read('src/pages/platform/DashboardPage.jsx');
assert.ok(dashboardSource.includes('>New Docket<'), 'Dashboard quick action naming should use New Docket');

const crmSource = read('src/pages/platform/CrmPage.jsx');
for (const label of ['New Client', 'Import Clients (CSV)', 'Go to Leads Queue']) {
  assert.ok(crmSource.includes(`>${label}<`), `CRM quick actions should use consistent wording: ${label}`);
}

const cmsSource = read('src/pages/platform/CmsPage.jsx');
for (const label of ['Go to Intake Queue', 'Go to Forms/Templates']) {
  assert.ok(cmsSource.includes(`>${label}<`), `CMS quick actions should use consistent wording: ${label}`);
}

const tasksSource = read('src/pages/platform/TaskManagerPage.jsx');
for (const label of ['Go to Workbasket', 'Go to My Worklist']) {
  assert.ok(tasksSource.includes(`>${label}<`), `Task Manager quick actions should use consistent wording: ${label}`);
}

console.log('workspaceCommandCenter.test.mjs passed');
