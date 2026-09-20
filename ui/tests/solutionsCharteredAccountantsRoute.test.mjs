import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Handle running from either repo root or ui/ directory
const isRepoRoot = fs.existsSync(path.resolve('ui'));
const uiRoot = isRepoRoot ? path.resolve('ui') : path.resolve('.');
const repoRoot = isRepoRoot ? path.resolve('.') : path.resolve('..');

test('Chartered Accountants route is properly configured in routes constants', () => {
  const routesPath = path.join(uiRoot, 'src', 'constants', 'routes.js');
  const routesContent = fs.readFileSync(routesPath, 'utf8');
  assert.match(
    routesContent,
    /SOLUTIONS_CHARTERED_ACCOUNTANTS:\s*['"]\/solutions\/chartered-accountants['"]/,
    'ROUTES should contain SOLUTIONS_CHARTERED_ACCOUNTANTS mapping to /solutions/chartered-accountants',
  );
});

test('Chartered Accountants page is registered in lazyPages and PublicRoutes', () => {
  const lazyPagesPath = path.join(uiRoot, 'src', 'routes', 'lazyPages.jsx');
  const lazyContent = fs.readFileSync(lazyPagesPath, 'utf8');
  assert.ok(
    lazyContent.includes('MarketingCharteredAccountantsPage'),
    'lazyPages.jsx should export MarketingCharteredAccountantsPage',
  );

  const publicRoutesPath = path.join(uiRoot, 'src', 'routes', 'PublicRoutes.jsx');
  const publicContent = fs.readFileSync(publicRoutesPath, 'utf8');
  assert.ok(
    publicContent.includes('MarketingCharteredAccountantsPage'),
    'PublicRoutes.jsx should import MarketingCharteredAccountantsPage',
  );
  assert.match(
    publicContent,
    /path="\/solutions\/chartered-accountants"/,
    'PublicRoutes.jsx should declare /solutions/chartered-accountants route',
  );
});

test('Next.js App Router page.tsx exists with required metadata and JSON-LD schema', () => {
  const nextAppPath = path.join(repoRoot, 'app', 'solutions', 'chartered-accountants', 'page.tsx');
  assert.ok(fs.existsSync(nextAppPath), 'app/solutions/chartered-accountants/page.tsx must exist');

  const pageContent = fs.readFileSync(nextAppPath, 'utf8');
  assert.ok(pageContent.includes('export const metadata: Metadata'), 'Must export Next.js Metadata');
  assert.ok(
    pageContent.includes('Practice Management Software for Chartered Accountants | Docketra'),
    'Metadata must have exact requested SEO title',
  );
  assert.ok(
    pageContent.includes('Purpose-built practice management for Indian CA firms'),
    'Metadata must have exact requested SEO description',
  );
  assert.ok(pageContent.includes('application/ld+json'), 'Must include JSON-LD script tag');
  assert.ok(
    pageContent.includes('"@type": "FAQPage"') || pageContent.includes("'@type': 'FAQPage'"),
    'JSON-LD schema must declare FAQPage',
  );

  // Check 3 CA FAQs in Next.js page
  assert.ok(
    pageContent.includes('How do role-based permissions work for article trainees and audit staff?'),
    'Next.js page must include trainee permissions FAQ',
  );
  assert.ok(
    pageContent.includes('Where is client financial data stored and how is domestic data residency handled?'),
    'Next.js page must include data residency FAQ',
  );
  assert.ok(
    /Can we export our firm.*complete data if we choose not to renew after the 3-month free pilot\?/.test(pageContent),
    'Next.js page must include data export FAQ',
  );
});

test('CharteredAccountantsSolutionPage contains all required CRO and SEO sections', () => {
  const pagePath = path.join(uiRoot, 'src', 'pages', 'marketing', 'CharteredAccountantsSolutionPage.jsx');
  assert.ok(fs.existsSync(pagePath), 'CharteredAccountantsSolutionPage.jsx must exist');
  const pageContent = fs.readFileSync(pagePath, 'utf8');

  // Pilot Eyebrow Banner
  assert.ok(
    pageContent.includes('🚀 Docketra Pilot Cohort for CA Practices'),
    'Pilot banner badge must be present',
  );
  assert.ok(
    pageContent.includes('3 Months Unrestricted Free Access • Pre-configured with Tax, Audit & GST Workbaskets'),
    'Pilot banner microcopy must be present',
  );

  // Hero Section
  assert.ok(
    pageContent.includes('The Operating Engine for'),
    'Hero title must be present',
  );
  assert.ok(
    pageContent.includes('High-Velocity CA Practices'),
    'Hero title CA focus must be present',
  );
  assert.ok(
    pageContent.includes('Stop managing audit working papers, GST reconciliations, and tax scrutiny deadlines'),
    'Hero subheadline must be present',
  );
  assert.ok(
    pageContent.includes('Start 3-Month Free Pilot'),
    'Primary CTA must be present',
  );
  assert.ok(pageContent.includes('#preview'), 'Secondary demo CTA must be present');
  assert.ok(
    pageContent.includes('No credit card required'),
    'Risk reversal subtext must be present',
  );
  assert.ok(
    pageContent.includes('1-Click Excel client master import'),
    'Excel import risk reversal must be present',
  );

  // The Reality Check Matrix (4 Points)
  assert.ok(pageContent.includes('Filing Deadlines Packed into Months'), 'Reality Check point 1 must be present');
  assert.ok(pageContent.includes('Reviewing Tax Drafts on WhatsApp'), 'Reality Check point 2 must be present');
  assert.ok(pageContent.includes('Article Assistant Turnover'), 'Reality Check point 3 must be present');
  assert.ok(pageContent.includes('"Who is Working on What?" Panic'), 'Reality Check point 4 must be present');

  // 4 Pillars Deep Dive
  assert.ok(pageContent.includes('Multi-Discipline Workbaskets'), 'Pillar 1 must be present');
  assert.ok(pageContent.includes('Client Memory & Working Records'), 'Pillar 2 must be present');
  assert.ok(pageContent.includes('4-Eye QC Review Gates'), 'Pillar 3 must be present');
  assert.ok(pageContent.includes('Zero-Friction Spreadsheet Migration'), 'Pillar 4 must be present');

  // Interactive Demo / Sandbox
  assert.ok(pageContent.includes('activePreviewTab'), 'Interactive preview tab state must be present');
  assert.ok(pageContent.includes('Tax & Audit Workbasket'), 'Preview tab 1 must be present');
  assert.ok(pageContent.includes('4-Eye QC Gate'), 'Preview tab 2 must be present');
  assert.ok(pageContent.includes('Client Memory Dossier'), 'Preview tab 3 must be present');

  // Interactive FAQ Accordion
  assert.ok(
    pageContent.includes('How do role-based permissions work for article trainees and audit staff?'),
    'FAQ 1 must be present',
  );
  assert.ok(
    pageContent.includes('Where is client financial data stored and how is domestic data residency handled?'),
    'FAQ 2 must be present',
  );
  assert.ok(
    /Can we export our firm.*complete data if we choose not to renew after the 3-month free pilot\?/.test(pageContent),
    'FAQ 3 must be present',
  );
  assert.ok(pageContent.includes('openFaqIndex'), 'Interactive accordion state must be present');

  // Closing Conversion Banner
  assert.ok(
    pageContent.includes('Upgrade Your CA Practice Ahead of the Next Filing Cycle'),
    'Closing headline must be present',
  );
  assert.ok(
    pageContent.includes('Start Your 3-Month Free Pilot →'),
    'Closing CTA button must be present',
  );
});
