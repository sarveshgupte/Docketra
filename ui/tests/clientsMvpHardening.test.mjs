import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const clientsPage = read('src/pages/ClientsPage.jsx');
assert.ok(clientsPage.includes('Add your first client to start creating dockets.'), 'Clients empty state should guide adding first client.');
assert.ok(clientsPage.includes('Client encryption setup needs repair before clients can be loaded.'), 'Clients page must include TENANT_KEY_MISSING handling copy.');
assert.ok(clientsPage.includes('You do not have permission to manage clients for this firm.'), 'Clients page must include 403 authorization copy.');
assert.ok(clientsPage.includes('Are you sure you want to ${action}'), 'Clients page must keep activate/deactivate confirmation prompt.');
assert.ok(clientsPage.includes('Client Name'), 'Clients page create/edit form should keep client name field.');
assert.ok(clientsPage.includes('Client Phone Number (Optional)'), 'Phone label should clearly be optional.');
assert.ok(clientsPage.includes('Client Email (Optional)'), 'Email label should clearly be optional.');
for (const blocked of ['PAN', 'GST Number', 'TAN', 'CIN', 'Contact Person Name', 'Contact Person Designation']) {
  assert.equal(clientsPage.includes(blocked), false, `Clients page MVP form should not require/display ${blocked}.`);
}
for (const blockedConcept of ['CMS', 'CRM', 'relationship graph', 'Company Brain']) {
  assert.equal(clientsPage.includes(blockedConcept), false, `Clients page should avoid dormant concept: ${blockedConcept}.`);
}

const guidedDocketForm = read('src/components/docket/GuidedDocketForm.jsx');
assert.ok(guidedDocketForm.includes('clientApi.getClients(true, true)'), 'Create Docket must load active clients only.');
assert.ok(guidedDocketForm.includes('.filter((item) => item?.isActive !== false)'), 'Create Docket must filter inactive clients from options.');

console.log('clientsMvpHardening.test.mjs passed');
