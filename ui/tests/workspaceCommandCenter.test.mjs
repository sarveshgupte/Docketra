import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const shellSource = read('src/components/platform/PlatformShell.jsx');
const paletteSource = read('src/components/common/CommandPalette.jsx');
const paletteCssSource = read('src/components/common/CommandPalette.css');
const shortcutsSource = read('src/utils/keyboardShortcuts.js');
const packageSource = read('package.json');
const navigationModelSource = read('src/constants/platformNavigation.js');

assert.ok(shellSource.includes('Search</span>'), 'Topbar should expose a concise search trigger');
assert.ok(shellSource.includes('Ctrl/⌘ K'), 'Trigger should use cross-platform shortcut copy');
assert.ok(shellSource.includes('isShortcutAllowedTarget(event.target)'), 'Platform shell should enforce typing target guard for all global shortcuts');
assert.ok(shellSource.includes("modifierPressed && key === 'k'"), 'Platform shell should own Cmd/Ctrl+K shortcut');
assert.ok(shellSource.includes("if (key === '/'"), 'Workspace should support quick open slash shortcut');
assert.ok(shellSource.includes('event.altKey && event.shiftKey'), 'Workspace should support collision-safe Alt+Shift route shortcuts');
assert.ok(shellSource.includes('searchRequestIdRef'), 'Search should use stale-response protection state');
assert.ok(shellSource.includes('looksLikeDocketIdQuery'), 'Command center should detect docket-id style queries for exact lookup.');
assert.ok(shellSource.includes('caseApi.getCaseById(term)'), 'Command center should resolve direct docket-id hits through the docket detail API.');
assert.ok(shellSource.includes("label: 'Pull to WL'"), 'Exact docket match should expose a pull-to-worklist secondary action when eligible.');
assert.ok(shellSource.includes("Alt+Enter pull to WL when available"), 'Shortcut helper should explain the pull secondary action.');
assert.ok(shellSource.includes('if (!commandPaletteOpen)'), 'Search should not run while command center is closed');
assert.ok(shellSource.includes('setSearchError('), 'Search should expose fallback error state');
assert.ok(shellSource.includes('resetCommandCenterState'), 'Close behavior should reset query/results/searching state');
assert.ok(shellSource.includes('closeCommandPalette()'), 'Palette close should be centralized for consistent cleanup');
assert.ok(shellSource.includes('normalizeClientRows'), 'Client IDs should be normalized before route mapping');
assert.ok(shellSource.includes('ROUTES.CLIENT_WORKSPACE(firmSlug, client.routeId)'), 'Client search results should open the actual client workspace route');
assert.ok(shellSource.includes('const hasRecordQuery = commandQuery.trim().length >= 2'), 'Record search sections should only lead once the user has typed a real query');
assert.ok(shellSource.includes("sections.push({ id: 'dockets', label: 'Dockets', items: docketItems });"), 'Docket results should be promoted ahead of generic commands for typed searches');
assert.ok(shellSource.includes("sections.push({ id: 'clients', label: 'Clients', items: clientItems });"), 'Client results should be promoted ahead of generic commands for typed searches');

for (const requiredCommand of [
  "'New Docket'",
  "'Go to Dashboard'",
  "'Go to Work'",
  "'Go to Relationships'",
  "'Go to Knowledge Intake'",
  "'Go to Workbench'",
  "'Go to My Worklist'",
  "'Go to QC Workbench'",
  "'Go to Clients'",
  "'Go to Reports'",
  "'Go to Settings'",
  "'Open Profile'",
  "'Sign out'",
]) {
  assert.ok(navigationModelSource.includes(requiredCommand) || shellSource.includes(requiredCommand), `Command center should contain required command: ${requiredCommand}`);
}


assert.ok(navigationModelSource.includes('getPlatformNavigation'), 'Navigation model should expose a single section source for sidebar rendering.');
assert.ok(navigationModelSource.includes('getPlatformDestinationCommands'), 'Navigation model should expose shared command-center destinations.');
assert.equal(paletteSource.includes('window.addEventListener'), false, 'CommandPalette should not register global keyboard listeners');
assert.ok(paletteSource.includes("import './CommandPalette.css';"), 'CommandPalette should import its own overlay styles.');
assert.ok(paletteSource.includes('role="combobox"'), 'CommandPalette should expose combobox semantics');
assert.ok(paletteSource.includes('role="listbox"'), 'CommandPalette should expose listbox semantics');
assert.ok(paletteSource.includes("event.key === 'Escape'"), 'CommandPalette should support reliable Escape close behavior');
assert.ok(paletteSource.includes("event.key === 'Enter'"), 'CommandPalette should execute active item with Enter');
assert.ok(paletteSource.includes('event.altKey && visibleItems[activeIndex]?.secondaryAction?.action'), 'CommandPalette should support Alt+Enter for the active secondary action.');
assert.ok(paletteSource.includes('command-palette__item-secondary'), 'CommandPalette should support a secondary action button for record-level actions.');
assert.ok(paletteSource.includes('setActiveIndex(0)'), 'CommandPalette should reset active index when closed');
assert.ok(paletteSource.includes('command-palette__input-shell'), 'CommandPalette should render a polished search input shell');
assert.ok(paletteSource.includes('command-palette__clear'), 'CommandPalette should support clearing a typed search');
assert.ok(paletteCssSource.includes('.command-palette__overlay'), 'CommandPalette CSS should include the overlay class that prevents raw in-page rendering');
assert.ok(paletteCssSource.includes('position: fixed;'), 'CommandPalette overlay and panel should use fixed positioning');
assert.ok(paletteCssSource.includes('.command-palette__input-shell'), 'CommandPalette CSS should style the search input shell');
assert.ok(paletteCssSource.includes('.command-palette__clear'), 'CommandPalette CSS should style the clear button');
assert.ok(paletteCssSource.includes('.command-palette__item-secondary'), 'CommandPalette CSS should style the secondary action button.');

assert.ok(shortcutsSource.includes('isEditableTarget'), 'Shared keyboard helper should define editable-target detection');
assert.ok(shortcutsSource.includes('input') && shortcutsSource.includes('textarea') && shortcutsSource.includes('select'), 'Editable target detection should include all core form controls');

assert.ok(packageSource.includes('"test:command-center": "node tests/workspaceCommandCenter.test.mjs"'), 'UI package scripts should include command center test entry');

const dashboardSource = read('src/pages/platform/DashboardPage.jsx');
assert.ok(dashboardSource.includes('>New Docket<'), 'Dashboard quick action naming should use New Docket');

const crmSource = read('src/pages/platform/CrmPage.jsx');
for (const label of ['New Client', 'Open Prospective Clients', 'Open Client Management']) {
  assert.ok(crmSource.includes(`>${label}<`), `CRM quick actions should use consistent wording: ${label}`);
}

const cmsSource = read('src/pages/platform/CmsPage.jsx');
for (const label of ['Go to Intake Queue', 'Go to Forms']) {
  assert.ok(cmsSource.includes(`>${label}<`), `CMS quick actions should use consistent wording: ${label}`);
}

const tasksSource = read('src/pages/platform/TaskManagerPage.jsx');
for (const label of ['Go to Workbench', 'Go to My Worklist']) {
  assert.ok(tasksSource.includes(label), `Task Manager quick actions should use consistent wording: ${label}`);
}

console.log('workspaceCommandCenter.test.mjs passed');
