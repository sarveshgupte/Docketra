import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const read = (file) => fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');

const cmsSource = read('ui/src/pages/platform/CmsPage.jsx');
assert.ok(cmsSource.includes('Create new form'), 'CMS page should expose create form action');
assert.ok(cmsSource.includes('await formsApi.createForm(payload)'), 'CMS page should create forms through forms API');
assert.ok(cmsSource.includes('Routing/config warnings'), 'CMS page should render routing/config warning count');
assert.ok(cmsSource.includes('Open Intake Settings'), 'CMS page should route admins to intake settings');

const publicRoutes = read('src/routes/public.routes.js');
assert.ok(publicRoutes.includes("router.post('/forms/:id/submit'"), 'Public form submission endpoint must stay wired');

const crmSource = read('ui/src/pages/platform/CrmPage.jsx');
assert.ok(crmSource.includes('Leads · new'), 'CRM overview should show lead stage counts');
assert.ok(crmSource.includes('Overdue follow-ups'), 'CRM overview should show overdue follow-up count');
assert.ok(crmSource.includes('Unpaid invoices'), 'CRM overview should show unpaid invoice count');

const crmApiSource = read('ui/src/api/crm.api.js');
assert.ok(crmApiSource.includes('convertLead'), 'CRM API should keep lead conversion endpoint');
assert.ok(crmApiSource.includes('createInvoice'), 'CRM API should keep invoice creation endpoint');
assert.ok(crmApiSource.includes('markInvoicePaid'), 'CRM API should keep invoice paid endpoint');

const protectedRoutes = read('ui/src/routes/ProtectedRoutes.jsx');
for (const route of ['path="crm"', 'path="crm/leads"', 'path="crm/clients"', 'path="cms"']) {
  assert.ok(protectedRoutes.includes(route), `Protected routes should include ${route}`);
}

console.log('crmCmsLaunchSmoke.test.mjs passed');
