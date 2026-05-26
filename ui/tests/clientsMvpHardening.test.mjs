import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const clientsPage = read('ui/src/pages/ClientsPage.jsx');
assert.ok(clientsPage.includes('Add your first client to start creating dockets.'), 'Clients empty state should guide adding first client.');
assert.ok(clientsPage.includes('Client encryption setup needs repair before clients can be loaded.'), 'Clients page must include TENANT_KEY_MISSING handling copy.');
assert.ok(clientsPage.includes('Client management requires Admin access.'), 'Clients page must include client-management denial copy.');
assert.ok(clientsPage.includes('Are you sure you want to ${action}'), 'Clients page must keep activate/deactivate confirmation prompt.');
assert.ok(clientsPage.includes('Business Name'), 'Clients page create/edit form should include business name field.');
assert.ok(clientsPage.includes('Business Contact Number'), 'Clients page should include business contact number field.');
assert.ok(clientsPage.includes('Business Email'), 'Clients page should include business email field.');
for (const requiredField of ['businessAddress', 'contactPersonName', 'PAN', 'CIN', 'TAN', 'GST']) {
  assert.ok(clientsPage.includes(requiredField), `Clients page form/payload should include ${requiredField}.`);
}
for (const requiredSection of ['Basic Details', 'Contact Details', 'Statutory / Registration Details']) {
  assert.ok(clientsPage.includes(requiredSection), `Clients page modal should include section ${requiredSection}.`);
}
for (const blockedConcept of ['CMS', 'CRM', 'relationship graph', 'Company Brain']) {
  assert.equal(clientsPage.includes(blockedConcept), false, `Clients page should avoid dormant concept: ${blockedConcept}.`);
}

const guidedDocketForm = read('ui/src/components/docket/GuidedDocketForm.jsx');
assert.ok(guidedDocketForm.includes('clientApi.getClients(true, true)'), 'Create Docket must load active clients only.');
assert.ok(guidedDocketForm.includes('.filter((item) => item?.isActive !== false)'), 'Create Docket must filter inactive clients from options.');

console.log('clientsMvpHardening.test.mjs passed');
