import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');

const publicRoutes = read('src/routes/PublicRoutes.jsx');
const marketingLayout = read('src/components/routing/MarketingLayout.jsx');
const homePage = read('src/pages/marketing/HomePage.jsx');
const landingContent = read('src/components/landing/LandingPageContent.jsx');

const expectedPublicRoutes = [
  '/',
  '/find-workspace',
  '/signup',
  '/:firmSlug/login',
  '/features',
  '/about',
  '/contact',
  '/terms',
  '/privacy',
  '/security',
  '/acceptable-use',
];

for (const route of expectedPublicRoutes) {
  assert.ok(publicRoutes.includes(`path="${route}"`), `Missing public route: ${route}`);
}

assert.ok(
  publicRoutes.includes('<Route path="/" element={<MarketingHomePage />} />'),
  'Root route must render MarketingHomePage.'
);
assert.equal(
  publicRoutes.includes('<Route element={<MarketingLayout />}>\n      <Route element={<RouteSuspenseOutlet />}>\n        <Route path="/" element={<MarketingHomePage />} />'),
  false,
  'Root route must not be nested under MarketingLayout.'
);

assert.ok(
  homePage.includes('<LandingPageContent />'),
  'MarketingHomePage should render LandingPageContent.'
);
assert.ok(
  landingContent.includes('<PublicMarketingHeader />')
    && landingContent.includes('<MarketingFooter />'),
  'Landing page must render PublicMarketingHeader and MarketingFooter.'
);

assert.ok(
  marketingLayout.includes('<AppLayout>') && marketingLayout.includes('<Outlet />'),
  'MarketingLayout should still wrap non-home marketing/legal pages via AppLayout.'
);

const footerLinks = ['/terms', '/privacy', '/security', '/acceptable-use'];

for (const link of footerLinks) {
  assert.ok(landingContent.includes(`to="${link}"`), `Landing footer missing link ${link}`);
  assert.ok(publicRoutes.includes(`path="${link}"`), `Landing footer link is not routable: ${link}`);
}

for (const removedLink of ['/features', '/about', '/contact']) {
  assert.equal(
    landingContent.includes(`to="${removedLink}"`),
    false,
    `Landing footer must not expose ${removedLink}.`
  );
}

assert.ok(landingContent.includes('<PublicMarketingHeader />'), 'Landing must render shared marketing header component.');
assert.ok(landingContent.includes("window.scrollTo({ top: 0, behavior: 'auto' });"), 'Unknown hash should safely scroll to top.');

assert.equal(/href\s*=\s*"#"/.test(landingContent), false, 'Landing page must not include placeholder href="#" links.');

console.log('publicLandingRouteSmoke.test.mjs passed');
