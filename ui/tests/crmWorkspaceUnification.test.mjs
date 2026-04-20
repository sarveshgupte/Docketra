import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const crmClientsSource = read('src/pages/crm/CrmClientsPage.jsx');
assert.ok(crmClientsSource.includes('title="Client Management"'), 'CRM clients page should use Client Management title contract');
assert.ok(crmClientsSource.includes('moduleLabel="CRM"'), 'CRM clients page should use CRM module label');
assert.ok(crmClientsSource.includes('Import Clients (CSV)'), 'CRM clients page should expose Import Clients (CSV) quick action');
assert.ok(crmClientsSource.includes('Go to Leads Queue'), 'CRM clients page should expose Go to Leads Queue quick action');
assert.equal(crmClientsSource.includes('neo-label'), false, 'CRM clients page should not include neo-label styles');
assert.equal(crmClientsSource.includes('neo-input'), false, 'CRM clients page should not include neo-input styles');
assert.equal(crmClientsSource.includes('components/common/Card'), false, 'CRM clients page should not use legacy Card composition');

const crmDetailSource = read('src/pages/crm/CrmClientDetailPage.jsx');
assert.ok(crmDetailSource.includes('moduleLabel="CRM"'), 'CRM client detail should use CRM module label');
assert.ok(crmDetailSource.includes('Back to Client Management'), 'CRM client detail should use Client Management naming');
assert.equal(crmDetailSource.includes('neo-table'), false, 'CRM client detail should not render neo-table styles');

const leadsSource = read('src/pages/crm/LeadsPage.jsx');
assert.ok(leadsSource.includes('title="Leads"'), 'Leads page should use Leads title contract');
assert.ok(leadsSource.includes('moduleLabel="CRM"'), 'Leads page should use CRM module label');
assert.equal(leadsSource.includes('PageHeader'), false, 'Leads page should not use legacy PageHeader wrapper');
assert.equal(leadsSource.includes('components/common/Card'), false, 'Leads page should not depend on legacy Card wrapper');

const crmUiUtilsSource = read('src/pages/crm/crmUiUtils.js');
assert.ok(crmUiUtilsSource.includes('includes(\'firm not found\')'), 'CRM error mapper should handle firm-not-found leakage');
assert.ok(crmUiUtilsSource.includes('resolveCrmErrorMessage'), 'CRM error mapper should expose resolveCrmErrorMessage');

const protectedRoutesSource = read('src/routes/ProtectedRoutes.jsx');
for (const route of ['path="crm"', 'path="crm/clients"', 'path="crm/clients/:crmClientId"', 'path="crm/leads"']) {
  assert.ok(protectedRoutesSource.includes(route), `Protected routes should retain CRM route: ${route}`);
}

console.log('crmWorkspaceUnification.test.mjs passed');
