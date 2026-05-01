import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (p) => fs.readFileSync(path.resolve(process.cwd(), p), 'utf8');

const protectedRoutes = read('src/routes/ProtectedRoutes.jsx');
const platformNav = read('src/constants/platformNavigation.js');
const routeConstants = read('src/constants/routes.js');
const companyBrainPage = read('src/pages/CompanyBrainPage.jsx');

assert.ok(
  protectedRoutes.includes('path="company-brain"') && protectedRoutes.includes('<ProtectedRoute requireAdmin>'),
  'Company Brain route should remain admin-only in protected firm routes.'
);

assert.ok(
  platformNav.includes("id: 'company-brain'") && platformNav.includes("label: 'Company Brain'") && platformNav.includes("section: 'Firm Memory'"),
  'Company Brain nav item should remain present in Firm Memory section.'
);

assert.ok(
  routeConstants.includes('COMPANY_BRAIN: (firmSlug) => `/app/firm/${firmSlug}/company-brain`'),
  'Company Brain route constant should remain unchanged.'
);

for (const apiCall of ['crmApi.listClients', 'crmApi.listLeads', 'dashboardApi.getSummary']) {
  assert.ok(companyBrainPage.includes(apiCall), `Company Brain should reuse existing API call ${apiCall}.`);
}

assert.equal(
  companyBrainPage.includes('vector') || companyBrainPage.includes('embeddings') || companyBrainPage.includes('document extraction'),
  false,
  'Company Brain read-only overview should not introduce AI/vector/document extraction infrastructure.'
);

console.log('companyBrainOverviewReadOnly.test.mjs passed');
