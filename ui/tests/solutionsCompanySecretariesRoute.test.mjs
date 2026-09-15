import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Handle running from either repo root or ui/ directory
const isRepoRoot = fs.existsSync(path.resolve('ui'));
const uiRoot = isRepoRoot ? path.resolve('ui') : path.resolve('.');
const repoRoot = isRepoRoot ? path.resolve('.') : path.resolve('..');

test('Company Secretaries route is properly configured in routes constants', () => {
  const routesPath = path.join(uiRoot, 'src', 'constants', 'routes.js');
  const routesContent = fs.readFileSync(routesPath, 'utf8');
  assert.match(
    routesContent,
    /SOLUTIONS_COMPANY_SECRETARIES:\s*['"]\/solutions\/company-secretaries['"]/,
    'ROUTES should contain SOLUTIONS_COMPANY_SECRETARIES mapping to /solutions/company-secretaries',
  );
});

test('Company Secretaries page is registered in lazyPages and PublicRoutes', () => {
  const lazyPagesPath = path.join(uiRoot, 'src', 'routes', 'lazyPages.jsx');
  const lazyContent = fs.readFileSync(lazyPagesPath, 'utf8');
  assert.ok(
    lazyContent.includes('MarketingCompanySecretariesPage'),
    'lazyPages.jsx should export MarketingCompanySecretariesPage',
  );

  const publicRoutesPath = path.join(uiRoot, 'src', 'routes', 'PublicRoutes.jsx');
  const publicContent = fs.readFileSync(publicRoutesPath, 'utf8');
  assert.ok(
    publicContent.includes('MarketingCompanySecretariesPage'),
    'PublicRoutes.jsx should import MarketingCompanySecretariesPage',
  );
  assert.match(
    publicContent,
    /path="\/solutions\/company-secretaries"/,
    'PublicRoutes.jsx should declare /solutions/company-secretaries route',
  );
});

test('Next.js App Router page.tsx exists with required metadata and JSON-LD schema', () => {
  const nextAppPath = path.join(repoRoot, 'app', 'solutions', 'company-secretaries', 'page.tsx');
  assert.ok(fs.existsSync(nextAppPath), 'app/solutions/company-secretaries/page.tsx must exist');

  const pageContent = fs.readFileSync(nextAppPath, 'utf8');
  assert.ok(pageContent.includes('export const metadata: Metadata'), 'Must export Next.js Metadata');
  assert.ok(
    pageContent.includes('Practice Management Software for Company Secretaries | Docketra'),
    'Metadata must have exact requested SEO title',
  );
  assert.ok(
    pageContent.includes('Purpose-built practice management for Indian Company Secretaries'),
    'Metadata must have exact requested SEO description',
  );
  assert.ok(pageContent.includes('application/ld+json'), 'Must include JSON-LD script tag');
  assert.ok(
    pageContent.includes('"@type": "FAQPage"') || pageContent.includes("'@type': 'FAQPage'"),
    'JSON-LD schema must declare FAQPage',
  );

  // Check 3 CS-specific FAQs in Next.js page
  assert.ok(
    pageContent.includes('How does Docketra support event-based MCA filings alongside regular annual compliance?'),
    'Next.js page must include event-based filings FAQ',
  );
  assert.ok(
    pageContent.includes('How is sensitive promoter and board confidentiality protected on Docketra?'),
    'Next.js page must include confidentiality FAQ',
  );
  assert.ok(
    pageContent.includes('What happens to our client records if we decide not to renew after the 3-month free pilot?'),
    'Next.js page must include data export guarantee FAQ',
  );
});

test('CompanySecretariesSolutionPage contains all required CRO and SEO sections', () => {
  const pagePath = path.join(uiRoot, 'src', 'pages', 'marketing', 'CompanySecretariesSolutionPage.jsx');
  assert.ok(fs.existsSync(pagePath), 'CompanySecretariesSolutionPage.jsx must exist');
  const pageContent = fs.readFileSync(pagePath, 'utf8');

  // Pilot Eyebrow Banner
  assert.ok(
    pageContent.includes('🚀 Docketra Pilot Cohort for CS Practices'),
    'Pilot banner badge must be present',
  );
  assert.ok(
    pageContent.includes('3 Months Unrestricted Free Access • Pre-built with MCA & Companies Act Workflows'),
    'Pilot banner microcopy must be present',
  );

  // Hero Section
  assert.ok(
    pageContent.includes('The Operating System for Modern'),
    'Hero title must be present',
  );
  assert.ok(
    pageContent.includes('Company Secretarial Practices'),
    'Hero title CS focus must be present',
  );
  assert.ok(
    pageContent.includes('Eliminate spreadsheet chaos across 200+ corporate clients'),
    'Hero subheadline must be present',
  );
  assert.ok(
    pageContent.includes('Claim 3 Months Free Access'),
    'Primary CTA must be present',
  );
  assert.ok(pageContent.includes('#preview'), 'Secondary demo CTA must be present');
  assert.ok(
    pageContent.includes('No credit card required'),
    'Risk reversal subtext must be present',
  );

  // The Reality Check Matrix (4 Points)
  assert.ok(pageContent.includes('MCA Portal Juggling'), 'Reality Check point 1 must be present');
  assert.ok(pageContent.includes('WhatsApp Draft Reviews'), 'Reality Check point 2 must be present');
  assert.ok(pageContent.includes('Annual Trainee Churn'), 'Reality Check point 3 must be present');
  assert.ok(pageContent.includes('Morning Status Panic'), 'Reality Check point 4 must be present');

  // 4 Pillars Deep Dive
  assert.ok(pageContent.includes('Native Entity Intelligence'), 'Pillar 1 must be present');
  assert.ok(pageContent.includes('Statutory Compliance Dockets'), 'Pillar 2 must be present');
  assert.ok(pageContent.includes('Board Governance & Actionables'), 'Pillar 3 must be present');
  assert.ok(pageContent.includes('Zero-Friction Excel & Copy-Paste Migration'), 'Pillar 4 must be present');

  // Interactive Demo / Sandbox
  assert.ok(pageContent.includes('activePreviewTab'), 'Interactive preview tab state must be present');
  assert.ok(pageContent.includes('MCA & ROC Telemetry'), 'Preview tab 1 must be present');
  assert.ok(pageContent.includes('Board Governance Vault'), 'Preview tab 2 must be present');
  assert.ok(pageContent.includes('Client Master Importer'), 'Preview tab 3 must be present');

  // Interactive FAQ Accordion
  assert.ok(
    pageContent.includes('How does Docketra support event-based MCA filings alongside regular annual compliance?'),
    'FAQ 1 must be present',
  );
  assert.ok(
    pageContent.includes('How is sensitive promoter and board confidentiality protected on Docketra?'),
    'FAQ 2 must be present',
  );
  assert.ok(
    pageContent.includes('What happens to our client records if we decide not to renew after the 3-month free pilot?'),
    'FAQ 3 must be present',
  );
  assert.ok(pageContent.includes('openFaqIndex'), 'Interactive accordion state must be present');

  // Closing Conversion Banner
  assert.ok(
    pageContent.includes('Upgrade Your Secretarial Practice Today'),
    'Closing headline must be present',
  );
  assert.ok(
    pageContent.includes('Claim 3 Months Free Access →'),
    'Closing CTA button must be present',
  );
});
