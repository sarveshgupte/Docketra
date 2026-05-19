import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relPath) => fs.readFileSync(path.resolve(process.cwd(), relPath), 'utf8');

const platformPages = [
  'src/pages/WorkSettingsPage.jsx',
  'src/pages/AiSettingsPage.jsx',
  'src/pages/FirmSettingsPage.jsx',
];

const deferredAllowlist = {
  // Firm settings still has broader legacy structure; defer to a dedicated refactor PR to avoid half-migration risk.
  'src/pages/FirmSettingsPage.jsx': 'Deferred: larger admin/settings surface; keep behavior stable in cleanup PR.',
};

for (const page of platformPages) {
  const source = read(page);
  assert.ok(source.includes('<PlatformShell'), `${page} should keep PlatformShell as root shell.`);

  if (!deferredAllowlist[page]) {
    assert.equal(source.includes('PageHeader'), false, `${page} should not import or render PageHeader in PlatformShell content.`);
    assert.equal(/\bmin-h-screen\b/.test(source), false, `${page} should not use min-h-screen wrappers in PlatformShell content.`);
    assert.equal(source.includes('max-w-5xl'), false, `${page} should not keep legacy max-w wrapper shell.`);
    assert.equal(source.includes('px-4 py-8'), false, `${page} should not keep legacy page-level px/py wrapper shell.`);
    assert.equal(source.includes('sm:px-6'), false, `${page} should not keep legacy responsive px wrapper shell.`);
    assert.equal(source.includes('style={{ margin'), false, `${page} should avoid inline margin layout styles.`);
    assert.equal(source.includes('style={{ padding'), false, `${page} should avoid inline padding layout styles.`);
  }
}

const platformCss = read('src/components/platform/platform.css');
for (const removedClass of ['.dashboard-next-step-title', '.dashboard-next-step-list', '.dashboard-activity-list .empty-state']) {
  assert.equal(platformCss.includes(removedClass), false, `${removedClass} should be removed from platform.css.`);
}

const whatsNew = read('../docs/whats-new.md');
assert.ok(whatsNew.includes('## 2026-05-19 — Cleaned up legacy workspace UI'), 'What\'s New should include legacy workspace UI cleanup entry.');

console.log('legacyUiCleanup.test.mjs passed');
