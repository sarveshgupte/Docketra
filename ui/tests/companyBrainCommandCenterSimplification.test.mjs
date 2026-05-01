import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');

const companyBrainPage = read('src/pages/CompanyBrainPage.jsx');
const routes = read('src/constants/routes.js');
const protectedRoutes = read('src/routes/ProtectedRoutes.jsx');

assert.ok(companyBrainPage.includes('Command Summary'), 'CompanyBrainPage must contain Command Summary section');
assert.ok(companyBrainPage.includes('Needs Attention'), 'CompanyBrainPage must contain Needs Attention section');
assert.ok(companyBrainPage.includes('Connected Map'), 'CompanyBrainPage must contain Connected Map section');
assert.ok(companyBrainPage.includes('How to use Company Brain'), 'CompanyBrainPage must contain How to use Company Brain section');

assert.ok(companyBrainPage.includes('export default CompanyBrainPage;'), 'CompanyBrainPage must retain a default export for lazy/default imports');

assert.ok(companyBrainPage.includes('crmApi.listClients'), 'CompanyBrainPage must call crmApi.listClients');
assert.ok(companyBrainPage.includes('crmApi.listLeads'), 'CompanyBrainPage must call crmApi.listLeads');
assert.ok(companyBrainPage.includes('dashboardApi.getSummary'), 'CompanyBrainPage must call dashboardApi.getSummary');
assert.ok(companyBrainPage.includes('knowledgeItemsApi.listKnowledgeItems'), 'CompanyBrainPage must call knowledgeItemsApi.listKnowledgeItems');

assert.ok(companyBrainPage.includes('ROUTES.KNOWLEDGE_LIBRARY(firmSlug)'), 'CompanyBrainPage must link to Knowledge Library');
assert.ok(/read-only/i.test(companyBrainPage), 'CompanyBrainPage must use read-only language');
assert.ok(/metadata links/i.test(companyBrainPage), 'CompanyBrainPage must use metadata-link language');

assert.equal(/import.*vector|import.*embedding|import.*openai|import.*anthropic|document extraction/i.test(companyBrainPage), false, 'CompanyBrainPage must not include AI/vector/embedding/document extraction infrastructure');

assert.ok(routes.includes('COMPANY_BRAIN'), 'Company Brain route must remain unchanged');
assert.ok(routes.includes('KNOWLEDGE_LIBRARY'), 'Knowledge Library route must remain unchanged');
assert.ok(protectedRoutes.includes('path="clients/:clientId"'), 'Client Memory route must remain unchanged');
assert.ok(routes.includes('CRM'), 'CRM route must remain unchanged');
assert.ok(routes.includes('CMS'), 'CMS route must remain unchanged');
assert.ok(routes.includes('TASK_MANAGER'), 'Task Manager route must remain unchanged');

console.log('companyBrainCommandCenterSimplification.test.mjs passed');
