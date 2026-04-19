import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROUTES } from '../src/constants/routes.js';

const firmSlug = 'acme-law';

const sidebarRoutes = [
  ROUTES.DASHBOARD(firmSlug),
  ROUTES.CASES(firmSlug),
  ROUTES.WORKLIST(firmSlug),
  ROUTES.GLOBAL_WORKLIST(firmSlug),
  ROUTES.QC_QUEUE(firmSlug),
  ROUTES.CLIENTS(firmSlug),
  ROUTES.COMPLIANCE_CALENDAR(firmSlug),
  ROUTES.CRM_CLIENTS(firmSlug),
  ROUTES.CRM_LEADS(firmSlug),
  ROUTES.CMS(firmSlug),
  ROUTES.ADMIN_REPORTS(firmSlug),
  ROUTES.ADMIN(firmSlug),
  ROUTES.HIERARCHY(firmSlug),
  ROUTES.FIRM_SETTINGS(firmSlug),
  ROUTES.WORK_SETTINGS(firmSlug),
  ROUTES.STORAGE_SETTINGS(firmSlug),
  ROUTES.AI_SETTINGS(firmSlug),
  ROUTES.SETTINGS(firmSlug),
  ROUTES.PROFILE(firmSlug),
];

const knownFirmRoutePrefixes = [
  `/app/firm/${firmSlug}/dashboard`,
  `/app/firm/${firmSlug}/dockets`,
  `/app/firm/${firmSlug}/worklist`,
  `/app/firm/${firmSlug}/my-worklist`,
  `/app/firm/${firmSlug}/global-worklist`,
  `/app/firm/${firmSlug}/qc-queue`,
  `/app/firm/${firmSlug}/compliance-calendar`,
  `/app/firm/${firmSlug}/clients`,
  `/app/firm/${firmSlug}/crm/clients`,
  `/app/firm/${firmSlug}/crm/leads`,
  `/app/firm/${firmSlug}/cms`,
  `/app/firm/${firmSlug}/admin`,
  `/app/firm/${firmSlug}/settings`,
  `/app/firm/${firmSlug}/storage-settings`,
  `/app/firm/${firmSlug}/ai-settings`,
  `/app/firm/${firmSlug}/profile`,
];

for (const route of sidebarRoutes) {
  assert.ok(route && !route.includes('undefined') && !route.includes('null'), `Invalid route generated: ${route}`);
  assert.ok(route.startsWith(`/app/firm/${firmSlug}/`), `Unexpected route namespace for ${route}`);
  assert.equal(route.includes('coming-soon'), false, `Placeholder route must not be in sidebar: ${route}`);
  const hasKnownPrefix = knownFirmRoutePrefixes.some((prefix) => route === prefix || route.startsWith(`${prefix}/`));
  assert.ok(hasKnownPrefix, `Sidebar route is not part of protected firm route map: ${route}`);
}

const uniqueRoutes = new Set(sidebarRoutes);
assert.equal(uniqueRoutes.size, sidebarRoutes.length, 'Sidebar route list should not contain duplicates');

const protectedRoutesPath = path.resolve(process.cwd(), 'src/routes/ProtectedRoutes.jsx');
const protectedRoutesSource = fs.readFileSync(protectedRoutesPath, 'utf8');
assert.ok(
  protectedRoutesSource.includes('<Route path="/app/firm/:firmSlug" element={<FirmLayout />}>'),
  'Firm-scoped routes must render in FirmLayout shell'
);

for (const expectedPath of ['path="dashboard"', 'path="dockets"', 'path="worklist"', 'path="global-worklist"', 'path="qc-queue"', 'path="clients"', 'path="crm/clients"', 'path="cms"', 'path="admin/reports"', 'path="settings"', 'path="profile"']) {
  assert.ok(
    protectedRoutesSource.includes(expectedPath),
    `Missing core protected route entry: ${expectedPath}`
  );
}

console.log('navigationReliability.test.mjs passed');
