import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', 'src');
const read = (relativePath) => fs.readFileSync(path.resolve(root, relativePath), 'utf8');

const protectedRoutes = read('routes/ProtectedRoutes.jsx');
const lazyPages = read('routes/lazyPages.jsx');
const superAdminLayout = read('components/common/SuperAdminLayout.jsx');
const firmsPage = read('pages/FirmsManagement.jsx');
const insightsPage = read('pages/SuperadminOnboardingInsightsPage.jsx');
const diagnosticsPage = read('pages/SuperadminDiagnosticsPage.jsx');
const dashboardPage = read('pages/SuperadminDashboard.jsx');
const firmDetailPage = read('pages/SuperadminFirmDetailPage.jsx');

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const activeSuperadminRoutes = [
  '/app/superadmin',
  '/app/superadmin/firms',
  '/app/superadmin/onboarding-insights',
  '/app/superadmin/onboarding-insights/:firmId',
  '/app/superadmin/diagnostics',
  '/app/superadmin/firms/:firmId',
];

for (const route of activeSuperadminRoutes) {
  assert.match(protectedRoutes, new RegExp(`path=\"${escapeRegExp(route)}\"`), `Missing protected route: ${route}`);
}

const requiredLazyExports = [
  'PlatformDashboard',
  'FirmsManagement',
  'SuperadminOnboardingInsightsPage',
  'SuperadminFirmOnboardingDetailPage',
  'SuperadminDiagnosticsPage',
  'SuperadminFirmDetailPage',
];

for (const exportName of requiredLazyExports) {
  assert.ok(
    lazyPages.includes(`export const ${exportName} = lazyPage(`),
    `Missing lazy route export for ${exportName}`,
  );
}

const navRouteMatches = [...superAdminLayout.matchAll(/to="(\/app\/superadmin(?:\/[^"]*)?)"/g)].map((match) => match[1]);
assert.ok(navRouteMatches.length > 0, 'Expected superadmin navigation links in SuperAdminLayout.');
for (const navRoute of navRouteMatches) {
  const routeDeclaration = `path="${navRoute}"`;
  assert.ok(protectedRoutes.includes(routeDeclaration), `Visible nav route is not protected/implemented: ${navRoute}`);
}

assert.ok(!/href\s*=\s*"#"/.test(superAdminLayout), 'Superadmin layout must not contain placeholder href="#" links.');

assert.ok(
  firmsPage.includes('if (error && (!firms || !Array.isArray(firms) || firms.length === 0))'),
  'Firms page should provide a readable top-level error state when no data is available.',
);
assert.ok(firmsPage.includes('No firms exist yet'), 'Firms page should provide a readable empty state.');


assert.ok(firmsPage.includes('to={`/app/superadmin/firms/${firm._id}`}'), 'Firm rows should link to the firm 360 detail page.');
assert.ok(
  firmDetailPage.includes('Firm 360 Detail')
    && firmDetailPage.includes('Firm identity')
    && firmDetailPage.includes('Admin management')
    && firmDetailPage.includes('Onboarding health')
    && firmDetailPage.includes('Storage / BYOS')
    && firmDetailPage.includes('Plan / limits')
    && firmDetailPage.includes('Support diagnostics'),
  'Firm detail page should render key section labels.',
);
assert.ok(
  firmDetailPage.includes('Superadmin can manage tenant lifecycle and support metadata, but cannot access firm client records, dockets, tasks, attachments, or private client content.'),
  'Firm detail page should include the explicit privacy boundary note.',
);

assert.ok(firmDetailPage.includes("admin.emailMasked || 'N/A'"), 'Firm detail page should only render masked admin email values.');
assert.ok(!firmDetailPage.includes('admin.emailMasked || admin.email ||'), 'Firm detail page should not fall back to raw admin.email.');
assert.ok(firmDetailPage.includes("admin.xID || admin.xid || admin.userXid || 'N/A'"), 'Firm detail page should support xID casing variants.');


assert.ok(
  dashboardPage.includes('Platform Command Center')
    && dashboardPage.includes('Needs attention today')
    && dashboardPage.includes('Firms Management')
    && dashboardPage.includes('Onboarding Insights')
    && dashboardPage.includes('Support Diagnostics'),
  'Platform dashboard should expose command center sections and quick links.',
);

assert.ok(insightsPage.includes('Insights unavailable') && insightsPage.includes('Retry') && insightsPage.includes('loadInsights'), 'Insights page should provide a readable empty/error state.');
assert.ok(
  diagnosticsPage.includes('Diagnostics unavailable')
    && diagnosticsPage.includes('Support diagnostics could not be loaded')
    && diagnosticsPage.includes('Retry')
    && diagnosticsPage.includes('loadDiagnostics'),
  'Diagnostics page should provide a readable empty/error state.',
);

console.log('superadminScreenReliability.test.mjs passed');
