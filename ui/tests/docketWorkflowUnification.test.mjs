import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const platformShellSource = read('src/components/platform/PlatformShell.jsx');
assert.ok(platformShellSource.includes('Sign out'), 'PlatformShell account menu should render a visible sign out action.');
assert.ok(platformShellSource.includes('aria-haspopup="menu"'), 'PlatformShell account menu trigger should expose menu semantics for accessibility.');
assert.ok(platformShellSource.includes('platform__user-pill-chevron'), 'PlatformShell user pill should include a clear dropdown affordance.');
assert.ok(platformShellSource.includes('await logout({ preserveFirmSlug: !!firmSlug });'), 'PlatformShell sign out should clear authenticated session state via auth context logout.');
assert.ok(platformShellSource.includes('ROUTES.FIRM_LOGIN(firmSlug)'), 'PlatformShell sign out should redirect firm users to the firm login route.');

const casesPageSource = read('src/pages/CasesPage.jsx');
assert.ok(casesPageSource.includes('returnTo='), 'Dockets list should preserve return context when opening docket detail.');

const caseDetailSource = read('src/pages/CaseDetailPage.jsx');
assert.ok(caseDetailSource.includes('handleBackToQueue'), 'Docket detail should expose an explicit back-to-queue action.');
assert.ok(caseDetailSource.includes('useDocketQueueNavigation'), 'Docket detail should resolve continuity return path via queue navigation hook.');

for (const page of ['src/pages/platform/WorklistPage.jsx', 'src/pages/platform/WorkbasketsPage.jsx', 'src/pages/platform/QcQueuePage.jsx']) {
  const source = read(page);
  assert.ok(source.includes('returnTo='), `${page} should preserve route context when linking to docket detail.`);
}

console.log('docketWorkflowUnification.test.mjs passed');
