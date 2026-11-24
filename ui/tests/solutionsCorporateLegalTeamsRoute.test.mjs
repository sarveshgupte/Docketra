import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Handle running from either repo root or ui/ directory
const isRepoRoot = fs.existsSync(path.resolve('ui'));
const uiRoot = isRepoRoot ? path.resolve('ui') : path.resolve('.');
const repoRoot = isRepoRoot ? path.resolve('.') : path.resolve('..');

test('Corporate Legal Teams route is properly configured in routes constants', () => {
  const routesPath = path.join(uiRoot, 'src', 'constants', 'routes.js');
  const routesContent = fs.readFileSync(routesPath, 'utf8');
  assert.match(
    routesContent,
    /SOLUTIONS_CORPORATE_LEGAL:\s*['"]\/solutions\/corporate-legal-teams['"]/,
    'ROUTES should contain SOLUTIONS_CORPORATE_LEGAL mapping to /solutions/corporate-legal-teams',
  );
});

test('Corporate Legal Teams page is registered in lazyPages and PublicRoutes', () => {
  const lazyPagesPath = path.join(uiRoot, 'src', 'routes', 'lazyPages.jsx');
  const lazyContent = fs.readFileSync(lazyPagesPath, 'utf8');
  assert.ok(
    lazyContent.includes('MarketingCorporateLegalTeamsPage'),
    'lazyPages.jsx should export MarketingCorporateLegalTeamsPage',
  );

  const publicRoutesPath = path.join(uiRoot, 'src', 'routes', 'PublicRoutes.jsx');
  const publicContent = fs.readFileSync(publicRoutesPath, 'utf8');
  assert.ok(
    publicContent.includes('MarketingCorporateLegalTeamsPage'),
    'PublicRoutes.jsx should import MarketingCorporateLegalTeamsPage',
  );
  assert.match(
    publicContent,
    /path="\/solutions\/corporate-legal-teams"/,
    'PublicRoutes.jsx should declare /solutions/corporate-legal-teams route',
  );
});

test('Next.js App Router page.tsx exists with required metadata and JSON-LD schema', () => {
  const nextAppPath = path.join(repoRoot, 'app', 'solutions', 'corporate-legal-teams', 'page.tsx');
  assert.ok(fs.existsSync(nextAppPath), 'app/solutions/corporate-legal-teams/page.tsx must exist');

  const pageContent = fs.readFileSync(nextAppPath, 'utf8');
  assert.ok(pageContent.includes('export const metadata: Metadata'), 'Must export Next.js Metadata');
  assert.ok(
    pageContent.includes('Legal Operations & Matter Management for In-House Teams | Docketra'),
    'Metadata must have exact requested SEO title',
  );
  assert.ok(
    pageContent.includes('Streamline in-house legal intake, contract dockets, and subsidiary compliance'),
    'Metadata must have exact requested SEO description',
  );
  assert.ok(pageContent.includes('application/ld+json'), 'Must include JSON-LD script tag');
  assert.ok(
    pageContent.includes('"@type": "FAQPage"') || pageContent.includes("'@type': 'FAQPage'"),
    'JSON-LD schema must declare FAQPage',
  );

  // Check 3 in-house legal FAQs in Next.js page
  assert.ok(
    pageContent.includes('How do role-based permissions work for business teams submitting legal intake requests?'),
    'Next.js page must include RBAC intake FAQ',
  );
  assert.ok(
    pageContent.includes("How does DocketsHQ ensure data sovereignty and compliance with India's DPDP Act?") ||
    pageContent.includes("How does Docketra ensure data sovereignty and compliance with India's Digital Personal Data Protection (DPDP) Act?"),
    'Next.js page must include data sovereignty / DPDP FAQ',
  );
  assert.ok(
    pageContent.includes('How straightforward is migrating ongoing litigation matters and contract repositories from Excel?'),
    'Next.js page must include Excel migration FAQ',
  );
});

test('CorporateLegalTeamsSolutionPage contains all required CRO and SEO sections', () => {
  const pagePath = path.join(uiRoot, 'src', 'pages', 'marketing', 'CorporateLegalTeamsSolutionPage.jsx');
  assert.ok(fs.existsSync(pagePath), 'CorporateLegalTeamsSolutionPage.jsx must exist');
  const pageContent = fs.readFileSync(pagePath, 'utf8');

  // Pilot Eyebrow Banner
  assert.ok(
    pageContent.includes('⚡ Enterprise Legal Pilot') ||
    pageContent.includes('🚀 Docketra Enterprise Pilot Cohort') ||
    pageContent.includes('Enterprise Legal Pilot'),
    'Pilot banner badge must be present',
  );
  assert.ok(
    pageContent.includes('3 Months Unrestricted Free Access for In-House Legal Departments • Tier-IV Indian Data Residency') ||
    pageContent.includes('3 Months Unrestricted Free Access for In-House Legal Teams • Tier-IV Indian Data Residency'),
    'Pilot banner microcopy must be present',
  );

  // Hero Section
  assert.ok(
    pageContent.includes('Total Operational Clarity for') ||
    pageContent.includes('Total operational clarity for'),
    'Hero title must be present',
  );
  assert.ok(
    pageContent.includes('In-House Legal & Compliance') ||
    pageContent.includes('in-house legal & compliance'),
    'Hero title in-house legal focus must be present',
  );
  assert.ok(
    pageContent.includes('Replace fragmented email threads, forgotten advisory requests') ||
    pageContent.includes('Replace drive-by Slack requests'),
    'Hero subheadline must be present',
  );
  assert.ok(
    pageContent.includes('Start 3-Month Free Pilot') ||
    pageContent.includes('Start 3-Month Enterprise Pilot'),
    'Primary CTA must be present',
  );
  assert.ok(
    pageContent.includes('#preview') ||
    pageContent.includes('#comparison'),
    'Secondary demo CTA must be present',
  );
  assert.ok(
    pageContent.includes('No credit card required'),
    'Risk reversal subtext must be present',
  );
  assert.ok(
    pageContent.includes('1-Click Excel matter migration') ||
    pageContent.includes('Instant Excel matter import') ||
    pageContent.includes('Excel matter'),
    'Excel migration risk reversal must be present',
  );

  // The Reality Check / Comparison Matrix or Capabilities
  assert.ok(
    pageContent.includes('Ad-Hoc Intake via Chat') ||
    pageContent.includes('Why Spreadsheets Fail Legal Operations') ||
    pageContent.includes('Spreadsheets & Slack (Old Way)'),
    'Comparison section must be present',
  );

  // Pillars / Deep Dive Capabilities
  assert.ok(
    pageContent.includes('Structured Legal Intake & Triage') ||
    pageContent.includes('Structured Legal Intake &amp; Triage'),
    'Intake & Triage capability must be present',
  );
  assert.ok(
    pageContent.includes('Entity & Subsidiary Governance') ||
    pageContent.includes('Group Subsidiary Master') ||
    pageContent.includes('Subsidiary Governance Master'),
    'Subsidiary Governance capability must be present',
  );
  assert.ok(
    pageContent.includes('4-Eye QC Review Baskets') ||
    pageContent.includes('4-Eye GC Review Gates'),
    '4-Eye Review capability must be present',
  );

  // Interactive Demo / Sandbox
  assert.ok(pageContent.includes('activePreviewTab'), 'Interactive preview tab state must be present');
  assert.ok(
    pageContent.includes('Intake & Triage Front Door') ||
    pageContent.includes('Intake &amp; Triage Front Door'),
    'Preview tab 1 must be present',
  );
  assert.ok(pageContent.includes('Subsidiary Governance Master'), 'Preview tab 2 must be present');
  assert.ok(
    pageContent.includes('Litigation & Notice Dockets') ||
    pageContent.includes('Litigation &amp; Notice Dockets'),
    'Preview tab 3 must be present',
  );

  // Interactive FAQ Accordion
  assert.ok(
    pageContent.includes('How do role-based permissions work for business teams submitting legal intake requests?'),
    'FAQ 1 must be present',
  );
  assert.ok(
    pageContent.includes("How does DocketsHQ ensure data sovereignty and compliance with India's DPDP Act?") ||
    pageContent.includes("How does Docketra ensure data sovereignty and compliance with India's Digital Personal Data Protection (DPDP) Act?"),
    'FAQ 2 must be present',
  );
  assert.ok(
    pageContent.includes('How straightforward is migrating ongoing litigation matters and contract repositories from Excel?'),
    'FAQ 3 must be present',
  );
  assert.ok(pageContent.includes('openFaqIndex'), 'Interactive accordion state must be present');

  // Closing Conversion Banner
  assert.ok(
    pageContent.includes('Bring Calm and Auditability to Your In-House Legal Ops') ||
    pageContent.includes('Bring calm and auditability to your in-house legal ops'),
    'Closing headline must be present',
  );
  assert.ok(
    pageContent.includes('Start Your 3-Month Free Pilot →') ||
    pageContent.includes('Claim Your Free Enterprise Seat →') ||
    pageContent.includes('Start 3-Month Enterprise Pilot'),
    'Closing CTA button must be present',
  );
});
