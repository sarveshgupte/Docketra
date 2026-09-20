import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const isRepoRoot = fs.existsSync(path.resolve('ui'));
const uiRoot = isRepoRoot ? path.resolve('ui') : path.resolve('.');

test('robots.txt exists, disallows private routes, and references sitemap', () => {
  const robotsPath = path.join(uiRoot, 'public', 'robots.txt');
  assert.ok(fs.existsSync(robotsPath), 'public/robots.txt must exist');
  const content = fs.readFileSync(robotsPath, 'utf8');

  assert.match(content, /User-agent:\s*\*/, 'robots.txt must declare User-agent: *');
  assert.match(content, /Disallow:\s*\/dashboard/, 'robots.txt must disallow /dashboard');
  assert.match(content, /Disallow:\s*\/app/, 'robots.txt must disallow /app');
  assert.match(content, /Disallow:\s*\/login/, 'robots.txt must disallow /login');
  assert.match(content, /Disallow:\s*\/admin/, 'robots.txt must disallow /admin');
  assert.match(content, /Disallow:\s*\/api/, 'robots.txt must disallow /api');
  assert.match(content, /Allow:\s*\/\s*$/m, 'robots.txt must explicitly allow /');
  assert.match(content, /Sitemap:\s*https:\/\/docketra\.in\/sitemap\.xml/, 'robots.txt must reference https://docketra.in/sitemap.xml');
});

test('sitemap.xml exists and includes all 14 public routes with valid schema', () => {
  const sitemapPath = path.join(uiRoot, 'public', 'sitemap.xml');
  assert.ok(fs.existsSync(sitemapPath), 'public/sitemap.xml must exist');
  const content = fs.readFileSync(sitemapPath, 'utf8');

  assert.ok(content.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), 'sitemap must have XML declaration');
  assert.ok(content.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'), 'sitemap must have urlset schema');

  const expectedRoutes = [
    'https://docketra.in/',
    'https://docketra.in/features',
    'https://docketra.in/pricing',
    'https://docketra.in/solutions/company-secretaries',
    'https://docketra.in/solutions/chartered-accountants',
    'https://docketra.in/solutions/corporate-legal-teams',
    'https://docketra.in/compare/docketra-vs-excel-whatsapp',
    'https://docketra.in/about',
    'https://docketra.in/contact',
    'https://docketra.in/security',
    'https://docketra.in/signup',
    'https://docketra.in/terms',
    'https://docketra.in/privacy',
    'https://docketra.in/acceptable-use',
  ];

  for (const url of expectedRoutes) {
    assert.ok(content.includes(`<loc>${url}</loc>`), `sitemap.xml must include <loc>${url}</loc>`);
  }

  // Ensure no private routes leak into sitemap
  for (const privatePath of ['/dashboard', '/app', '/login', '/admin', '/superadmin', '/api']) {
    assert.ok(!content.includes(`https://docketra.in${privatePath}<`), `sitemap must NOT contain ${privatePath}`);
  }
});

test('og-image.png exists in public directory and has valid dimensions/size', () => {
  const ogImagePath = path.join(uiRoot, 'public', 'og-image.png');
  assert.ok(fs.existsSync(ogImagePath), 'public/og-image.png must exist');
  const stat = fs.statSync(ogImagePath);
  assert.ok(stat.size > 5000, `og-image.png size (${stat.size} bytes) should be substantial`);
});

test('index.html contains enhanced metadata and JSON-LD structured data', () => {
  const indexPath = path.join(uiRoot, 'index.html');
  const content = fs.readFileSync(indexPath, 'utf8');

  // Title & description
  assert.ok(content.includes('<title>Docketra — The Company Brain for Indian Professional Firms</title>'), 'index.html title must match');
  assert.match(content, /<meta\s+name="description"\s+content="[^"]*CS, CA, and legal firms[^"]*"/, 'index.html description must mention CS, CA, and legal firms');
  assert.ok(content.includes('<link rel="canonical" href="https://docketra.in/" />'), 'index.html must have canonical link');

  // Open Graph
  assert.ok(content.includes('<meta property="og:image" content="https://docketra.in/og-image.png" />'), 'og:image must be absolute');
  assert.ok(content.includes('<meta name="twitter:card" content="summary_large_image" />'), 'twitter card must be summary_large_image');

  // JSON-LD
  assert.ok(content.includes('application/ld+json'), 'index.html must include JSON-LD');
  assert.ok(content.includes('"@type": "Organization"'), 'JSON-LD must include Organization');
  assert.ok(content.includes('"@type": "SoftwareApplication"'), 'JSON-LD must include SoftwareApplication');
  assert.ok(content.includes('"priceCurrency": "INR"'), 'SoftwareApplication must specify priceCurrency');
});

test('Public marketing pages utilize SeoHead and avoid duplicate h1 tags', () => {
  const marketingPages = [
    path.join(uiRoot, 'src', 'components', 'landing', 'LandingPageContent.jsx'),
    path.join(uiRoot, 'src', 'pages', 'marketing', 'Pricing.jsx'),
    path.join(uiRoot, 'src', 'pages', 'marketing', 'Features.jsx'),
    path.join(uiRoot, 'src', 'pages', 'marketing', 'CompanySecretariesSolutionPage.jsx'),
    path.join(uiRoot, 'src', 'pages', 'marketing', 'CharteredAccountantsSolutionPage.jsx'),
    path.join(uiRoot, 'src', 'pages', 'marketing', 'CorporateLegalTeamsSolutionPage.jsx'),
    path.join(uiRoot, 'src', 'pages', 'marketing', 'DocketraVsExcelWhatsAppPage.jsx'),
    path.join(uiRoot, 'src', 'pages', 'marketing', 'Signup.jsx'),
  ];

  for (const pageFile of marketingPages) {
    assert.ok(fs.existsSync(pageFile), `${pageFile} must exist`);
    const content = fs.readFileSync(pageFile, 'utf8');
    assert.ok(content.includes('SeoHead'), `${path.basename(pageFile)} must integrate SeoHead`);
  }
});
