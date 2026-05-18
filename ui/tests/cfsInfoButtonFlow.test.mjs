import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const caseDetail = read('src/pages/CaseDetailPage.jsx');
assert.ok(caseDetail.includes("openSidebar('cfs')"), 'CaseDetailPage should wire the CFS info action to openSidebar(\'cfs\').');
assert.ok(caseDetail.includes('aria-label="Open client fact sheet"'), 'CaseDetailPage should expose accessible CFS info button label.');
assert.ok(caseDetail.includes('title="Open Client Fact Sheet"'), 'CaseDetailPage should expose CFS tooltip/title text.');
assert.ok(caseDetail.includes('TENANT_KEY_MISSING'), 'CaseDetailPage should detect TENANT_KEY_MISSING failures for CFS loading.');
assert.ok(caseDetail.includes('Client encryption setup needs repair before the fact sheet can be loaded.'), 'CaseDetailPage should show tenant-key repair copy for CFS failures.');

const docketSidebar = read('src/components/docket/DocketSidebar.jsx');
assert.ok(docketSidebar.includes("type === 'cfs'"), 'DocketSidebar should support CFS sidebar mode.');
assert.ok(docketSidebar.includes('No client fact sheet details added yet.'), 'DocketSidebar should provide an empty CFS state.');
assert.ok(docketSidebar.includes('Client Status:'), 'DocketSidebar should display client status metadata.');
assert.ok(docketSidebar.includes('role="dialog"'), 'DocketSidebar should expose dialog semantics for the sidebar panel.');
assert.ok(docketSidebar.includes("event.key === 'Escape'"), 'DocketSidebar should close on Escape for keyboard users.');
assert.ok(docketSidebar.includes('Upload link copied to clipboard.'), 'DocketSidebar should announce upload link copy feedback.');

const clientsPage = read('src/pages/ClientsPage.jsx');
assert.ok(clientsPage.includes('Edit CFS'), 'ClientsPage should keep Edit CFS actions.');

const bannedCopy = [
  'Company Brain',
  'relationship graph',
  'CMS Intake',
  'Knowledge Library',
];
for (const phrase of bannedCopy) {
  assert.ok(!docketSidebar.includes(phrase), `DocketSidebar should not introduce non-MVP copy: ${phrase}`);
}

console.log('cfsInfoButtonFlow.test.mjs passed');
