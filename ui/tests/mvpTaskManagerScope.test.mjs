import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const layout = fs.readFileSync(path.resolve(process.cwd(), 'src/components/common/Layout.jsx'), 'utf8');
assert.ok(layout.includes("label: 'Clients'"), 'Sidebar must keep Clients navigation visible.');
assert.equal(layout.includes("label: 'CMS'"), false, 'Sidebar must hide CMS module.');
assert.equal(layout.includes("label: 'CRM'"), false, 'Sidebar must hide advanced CRM module group.');

const workSettings = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/WorkSettingsPage.jsx'), 'utf8');
assert.ok(workSettings.includes('Workbasket Management'), 'Work Settings must still render workbasket management.');
for (const blocked of ['CMS Intake Settings', 'getCmsIntakeSettings', 'updateCmsIntakeSettings', 'regenerateCmsIntakeApiKey']) {
  assert.equal(workSettings.includes(blocked), false, `Work Settings should not include ${blocked}.`);
}

const createDocket = fs.readFileSync(path.resolve(process.cwd(), 'src/components/docket/GuidedDocketForm.jsx'), 'utf8');
assert.ok(createDocket.includes('label="Client (defaults to your firm for internal work)"'), 'Create Docket must keep client selection.');
assert.ok(createDocket.includes('defaults to your firm for internal work'), 'Create Docket must support default firm client guidance.');

console.log('mvpTaskManagerScope.test.mjs passed');
