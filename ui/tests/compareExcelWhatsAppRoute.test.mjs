import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Handle running from either repo root or ui/ directory
const isRepoRoot = fs.existsSync(path.resolve('ui'));
const uiRoot = isRepoRoot ? path.resolve('ui') : path.resolve('.');
const repoRoot = isRepoRoot ? path.resolve('.') : path.resolve('..');

test('Compare Excel & WhatsApp route is properly configured in routes constants', () => {
  const routesPath = path.join(uiRoot, 'src', 'constants', 'routes.js');
  const routesContent = fs.readFileSync(routesPath, 'utf8');
  assert.match(
    routesContent,
    /COMPARE_EXCEL_WHATSAPP:\s*['"]\/compare\/docketra-vs-excel-whatsapp['"]/,
    'ROUTES should contain COMPARE_EXCEL_WHATSAPP mapping to /compare/docketra-vs-excel-whatsapp',
  );
});

test('Compare Excel & WhatsApp page is registered in lazyPages and PublicRoutes', () => {
  const lazyPagesPath = path.join(uiRoot, 'src', 'routes', 'lazyPages.jsx');
  const lazyContent = fs.readFileSync(lazyPagesPath, 'utf8');
  assert.ok(
    lazyContent.includes('MarketingCompareExcelWhatsAppPage'),
    'lazyPages.jsx should export MarketingCompareExcelWhatsAppPage',
  );

  const publicRoutesPath = path.join(uiRoot, 'src', 'routes', 'PublicRoutes.jsx');
  const publicContent = fs.readFileSync(publicRoutesPath, 'utf8');
  assert.ok(
    publicContent.includes('MarketingCompareExcelWhatsAppPage'),
    'PublicRoutes.jsx should import MarketingCompareExcelWhatsAppPage',
  );
  assert.match(
    publicContent,
    /path="\/compare\/docketra-vs-excel-whatsapp"/,
    'PublicRoutes.jsx should declare /compare/docketra-vs-excel-whatsapp route',
  );
});

test('Next.js App Router page.tsx exists with required metadata and JSON-LD schema', () => {
  const nextAppPath = path.join(repoRoot, 'app', 'compare', 'docketra-vs-excel-whatsapp', 'page.tsx');
  assert.ok(fs.existsSync(nextAppPath), 'app/compare/docketra-vs-excel-whatsapp/page.tsx must exist');

  const pageContent = fs.readFileSync(nextAppPath, 'utf8');
  assert.ok(pageContent.includes('export const metadata: Metadata'), 'Must export Next.js Metadata');
  assert.ok(
    pageContent.includes('Docketra vs Excel & WhatsApp | 3-Month Free Pilot for Indian Compliance Firms'),
    'Metadata must have exact requested SEO title',
  );
  assert.ok(
    pageContent.includes('Outgrow spreadsheet chaos and lost WhatsApp files'),
    'Metadata must have exact requested SEO description',
  );
  assert.ok(pageContent.includes('application/ld+json'), 'Must include JSON-LD script tag');
  assert.ok(
    pageContent.includes("FAQPage"),
    'JSON-LD schema must declare FAQPage',
  );
});

test('DocketraVsExcelWhatsAppPage contains all required CRO and SEO sections', () => {
  const pagePath = path.join(uiRoot, 'src', 'pages', 'marketing', 'DocketraVsExcelWhatsAppPage.jsx');
  const pageContent = fs.readFileSync(pagePath, 'utf8');

  // Pilot Eyebrow Banner
  assert.ok(pageContent.includes('🚀 Docketra Pilot Cohort Open'), 'Pilot banner badge must be present');
  assert.ok(pageContent.includes('3 Months Free Access • 0 Setup Fees'), 'Pilot banner microcopy must be present');

  // Hero Section
  assert.ok(
    pageContent.includes('The Hidden Cost of Managing Indian Compliance on'),
    'Hero title must discuss hidden cost',
  );
  assert.ok(pageContent.includes('Join Pilot (3 Months Free)'), 'Primary CTA must be present');
  assert.ok(pageContent.includes('#sandbox-preview'), 'Secondary sandbox CTA must be present');
  assert.ok(pageContent.includes('1-Click Excel data import'), 'Risk reversal subtext must be present');

  // The 5 Comparison Matrix points
  assert.ok(pageContent.includes('Statutory Deadline Tracking'), 'Comparison row 1 must be present');
  assert.ok(pageContent.includes('Quality Control & Sign-offs'), 'Comparison row 2 must be present');
  assert.ok(pageContent.includes('Staff & Trainee Turnover'), 'Comparison row 3 must be present');
  assert.ok(pageContent.includes('Partner Visibility & Queue Health'), 'Comparison row 4 must be present');
  assert.ok(pageContent.includes('Data Sovereignty & Security'), 'Comparison row 5 must be present');

  // The 4 Breaking Points
  assert.ok(pageContent.includes('The Senior Partner Becomes an Internal Search Engine'), 'Breaking point 1 must be present');
  assert.ok(pageContent.includes('QC Reviews Disappear into WhatsApp Noise'), 'Breaking point 2 must be present');
  assert.ok(pageContent.includes('Institutional Brain Drain on Staff Exit'), 'Breaking point 3 must be present');
  assert.ok(pageContent.includes('Zero Real-Time Capacity Planning'), 'Breaking point 4 must be present');

  // 4 Native Migration Engines
  assert.ok(pageContent.includes('Client Master Importer'), 'Migration engine 1 must be present');
  assert.ok(pageContent.includes('Quick Bulk Paste'), 'Migration engine 2 must be present');
  assert.ok(pageContent.includes('Historical Docket Importer'), 'Migration engine 3 must be present');
  assert.ok(pageContent.includes('Team & Taxonomy Bulk Setup'), 'Migration engine 4 must be present');

  // Interactive FAQ Accordion
  assert.ok(pageContent.includes('What is included in the 3-month free pilot?'), 'FAQ 1 must be present');
  assert.ok(pageContent.includes('How hard is it to migrate our existing client spreadsheet?'), 'FAQ 2 must be present');
  assert.ok(pageContent.includes('How does Docketra handle Indian statutory formats?'), 'FAQ 3 must be present');
  assert.ok(pageContent.includes('openFaqIndex'), 'Interactive accordion state must be present');

  // Closing CTA Banner
  assert.ok(pageContent.includes('Upgrade Your Firm’s Operating Engine Risk-Free'), 'Closing headline must be present');
  assert.ok(pageContent.includes('Start Your 3-Month Free Pilot →'), 'Closing CTA button must be present');
});
