import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const isRepoRoot = fs.existsSync(path.resolve('ui'));
const uiRoot = isRepoRoot ? path.resolve('ui') : path.resolve('.');

test('PublicMarketingHeader defines Pricing route navigation link', () => {
  const headerPath = path.join(uiRoot, 'src', 'components', 'marketing', 'PublicMarketingHeader.jsx');
  const content = fs.readFileSync(headerPath, 'utf8');

  assert.ok(
    content.includes("label: 'Pricing', href: '/pricing'"),
    'PublicMarketingHeader NAV_LINKS must include Pricing with href: /pricing',
  );
  assert.ok(
    content.includes("href && !href.startsWith('#') && !href.startsWith('/#')"),
    'handleSectionNavigation must distinguish direct route links from section hash anchors',
  );
});

test('BubbleMenu renders Pricing link in both desktop navbar and mobile drawer', () => {
  const bubbleMenuPath = path.join(uiRoot, 'src', 'components', 'common', 'BubbleMenu.jsx');
  const content = fs.readFileSync(bubbleMenuPath, 'utf8');

  assert.ok(
    content.includes("label: 'Pricing', href: '/pricing'"),
    'BubbleMenu DEFAULT_ITEMS must include Pricing with href: /pricing',
  );
  assert.ok(
    content.includes("location.pathname === itemHref"),
    'BubbleMenu must support active route indicator styling for full page routes like /pricing',
  );
});

test('Marketing footers include direct link to /pricing', () => {
  const landingPath = path.join(uiRoot, 'src', 'components', 'landing', 'LandingPageContent.jsx');
  const landingContent = fs.readFileSync(landingPath, 'utf8');
  assert.ok(
    landingContent.includes('to="/pricing"'),
    'LandingPageContent MarketingFooter must include Link to /pricing',
  );

  const appLayoutPath = path.join(uiRoot, 'src', 'components', 'routing', 'AppLayout.jsx');
  const appLayoutContent = fs.readFileSync(appLayoutPath, 'utf8');
  assert.ok(
    appLayoutContent.includes('to="/pricing"'),
    'AppLayout footer must include Link to /pricing',
  );
});

test('Pricing page hides rupee costs, shows Coming Soon and tier limits for 26-firm pilot', () => {
  const pricingPath = path.join(uiRoot, 'src', 'pages', 'marketing', 'Pricing.jsx');
  const content = fs.readFileSync(pricingPath, 'utf8');

  assert.equal(
    /₹\s*(12,990|17,990|1,999|21,990|27,990|2,499|59,990|4,999|1,200|6,500)/.test(content),
    false,
    'Pricing page must hide rupee prices while paid pricing is coming soon',
  );
  assert.ok(content.includes('Coming Soon'), 'Pricing page must mark paid tiers as Coming Soon');
  assert.ok(content.includes('26'), 'Pricing page must highlight 26 founding pilot firms');
  assert.ok(content.includes('Up to 5 team seats / 50 active clients'), 'Starter tier limits must stay visible');
  assert.ok(content.includes('Up to 12 team seats / 150 active clients'), 'Growth tier limits must stay visible');
  assert.ok(content.includes('Up to 25 team seats / Unlimited active clients'), 'Pro tier limits must stay visible');
});

test('FirmSettingsPage and SuperadminDashboard reflect 26-firm unlimited pilot & 20-firm trigger', () => {
  const settingsPath = path.join(uiRoot, 'src', 'pages', 'FirmSettingsPage.jsx');
  const settingsContent = fs.readFileSync(settingsPath, 'utf8');
  assert.equal(
    /₹\s*(12,990|17,990|1,999|21,990|27,990|2,499|59,990|4,999|6,500)/.test(settingsContent),
    false,
    'FirmSettingsPage must hide tier rupee costs while pricing is coming soon',
  );
  assert.ok(settingsContent.includes('Pricing Coming Soon'), 'FirmSettingsPage must show Pricing Coming Soon on paid tiers');
  assert.ok(settingsContent.includes("?? 'Unlimited'"), 'FirmSettingsPage must render Unlimited cleanly when maxSeats/maxClients is null');

  const superadminPath = path.join(uiRoot, 'src', 'pages', 'SuperadminDashboard.jsx');
  const superadminContent = fs.readFileSync(superadminPath, 'utf8');
  assert.ok(superadminContent.includes('pilotCohort.pricingReviewTriggered'), 'SuperadminDashboard must render 20-firm milestone review trigger');
  assert.ok(superadminContent.includes('maxFirms: 26'), 'SuperadminDashboard must default cohort target to 26 firms');
});
