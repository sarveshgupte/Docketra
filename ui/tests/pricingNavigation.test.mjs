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
