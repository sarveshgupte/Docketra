import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const shellSource = read('src/components/platform/PlatformShell.jsx');
const navSource = read('src/constants/platformNavigation.js');
const cssSource = read('src/components/platform/platform.css');

assert.ok(shellSource.includes('<aside className={`platform__sidebar'), 'PlatformShell should render sidebar landmark.');
assert.ok(shellSource.includes('<nav className="platform__nav">'), 'PlatformShell should render nav landmark.');
assert.ok(shellSource.includes('<header className="platform__topbar">'), 'PlatformShell should render header landmark.');
assert.ok(shellSource.includes('<main id="platform-main" className="platform__content">'), 'PlatformShell should render main landmark.');
assert.ok(shellSource.includes('isNavItemActive(pathname, item)'), 'PlatformShell should keep nav active wiring.');
assert.ok(shellSource.includes('role="toolbar" aria-label="Page actions"'), 'Topbar actions should keep toolbar labels.');
assert.ok(shellSource.includes('className="platform__command-trigger"'), 'Topbar should include command trigger.');
assert.ok(shellSource.includes('<StorageStatusBadge />'), 'Topbar should include storage badge.');
assert.ok(shellSource.includes('aria-haspopup="menu"'), 'Account menu should keep accessibility attributes.');
assert.ok(shellSource.includes('aria-expanded={menuOpen}'), 'Account menu should keep expanded state semantics.');
assert.ok(shellSource.includes('const showBreadcrumbs = useMemo(() => {'), 'Breadcrumb rendering should use explicit safety guard.');
assert.ok(shellSource.includes('actions ? <div className="platform__action-primary">{actions}</div> : null'), 'Action rail should avoid empty action primary markup.');

for (const section of ['Daily Operations', 'Client Workspace', 'Oversight', 'Administration']) {
  assert.ok(navSource.includes(`section: '${section}'`), `Navigation should preserve ${section} grouping.`);
}
assert.ok(navSource.includes("id: 'workbaskets-overview'"), 'Daily Operations should preserve Workbasket Overview for manager+ users.');
assert.ok(navSource.includes('...directWorkbasketItems,'), 'Direct assigned workbasket links should remain preserved under grouped Workbaskets.');
assert.ok(navSource.includes("id: 'workbaskets-group'"), 'Daily Operations should preserve grouped Workbaskets container.');
assert.ok(navSource.includes("id: 'my-worklist'"), 'Daily Operations should preserve My Worklist.');
assert.ok(navSource.includes("id: 'qc-worklist'"), 'Daily Operations should preserve QC Worklist when allowed.');
assert.ok(navSource.includes('...directQcWorkbasketItems,'), 'Direct assigned QC workbasket links should remain preserved under grouped QC Worklists.');
assert.ok(navSource.includes("id: 'qc-worklists-group'"), 'Daily Operations should preserve grouped QC Worklists container when applicable.');

for (const cls of ['.platform__action-search', '.platform__action-primary', '.platform__action-status', '.platform__module-label', '.platform__nav-section']) {
  assert.ok(cssSource.includes(cls), `Shell CSS should include polished class ${cls}.`);
}
assert.ok(cssSource.includes('@media (max-width: 768px) {\n  .platform {\n    grid-template-columns: 1fr;\n    grid-template-rows: auto 1fr;\n  }'), 'Mobile shell should use scoped single-column grid layout.');
assert.equal(cssSource.includes('\n.platform { grid-template-columns: 1fr; }\n'), false, 'Unscoped global shell grid override should not be reintroduced.');

console.log('platformShellPolish.test.mjs passed');
