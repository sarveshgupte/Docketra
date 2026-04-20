import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const cmsSource = read('src/pages/platform/CmsPage.jsx');
assert.ok(cmsSource.includes('if (formSaving) return;'), 'CMS form save should block duplicate submits.');
assert.ok(cmsSource.includes('Field key "${field.key}" is duplicated'), 'CMS form save should validate duplicate field keys.');
assert.ok(cmsSource.includes('new URL(redirectUrl)'), 'CMS form save should validate redirect URLs.');
assert.ok(cmsSource.includes('safeRoute(`${ROUTES.WORK_SETTINGS(firmSlug)}#cms-intake-settings`)'), 'CMS intake settings link should use safe route + anchor generation.');
assert.ok(cmsSource.includes('}, [selectedForm]);'), 'CMS editor should rehydrate when selected form data updates.');

const crmClientsSource = read('src/pages/crm/CrmClientsPage.jsx');
assert.ok(crmClientsSource.includes('role="link"'), 'CRM clients table rows should expose link role for keyboard users.');
assert.ok(crmClientsSource.includes('onKeyDown={(event) => {'), 'CRM clients table rows should support keyboard navigation.');
assert.ok(crmClientsSource.includes('setDeactivatingId(clientId);'), 'CRM clients deactivation should prevent duplicate submits.');

const crmDetailSource = read('src/pages/crm/CrmClientDetailPage.jsx');
assert.ok(crmDetailSource.includes('const closeDealModal = () => {'), 'CRM detail deal modal should reset local state on close.');
assert.ok(crmDetailSource.includes('const closeInvoiceModal = () => {'), 'CRM detail invoice modal should reset local state on close.');
assert.ok(crmDetailSource.includes('tabIndex={0}'), 'CRM detail docket rows should be keyboard focusable.');

const leadsSource = read('src/pages/crm/LeadsPage.jsx');
assert.ok(leadsSource.includes('const closeModal = () => {'), 'Leads create modal should reset form state on close.');
assert.ok(leadsSource.includes('const closeDetail = () => {'), 'Leads detail modal should reset selected lead/form state on close.');
assert.ok(leadsSource.includes('setLeads(toRows(response?.data));'), 'Leads loader should normalize API list payloads.');

console.log('crmCmsHardening.test.mjs passed');
