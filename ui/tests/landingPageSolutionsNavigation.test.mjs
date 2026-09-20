import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Handle running from either repo root or ui/ directory
const isRepoRoot = fs.existsSync(path.resolve('ui'));
const uiRoot = isRepoRoot ? path.resolve('ui') : path.resolve('.');

test('Landing page hero contains prominent links to all practice solutions', () => {
  const landingPagePath = path.join(uiRoot, 'src', 'components', 'landing', 'LandingPageContent.jsx');
  const content = fs.readFileSync(landingPagePath, 'utf8');

  assert.ok(
    content.includes('to="/solutions/company-secretaries"'),
    'Hero must link to /solutions/company-secretaries',
  );
  assert.ok(
    content.includes('to="/solutions/chartered-accountants"'),
    'Hero must link to /solutions/chartered-accountants',
  );
  assert.ok(
    content.includes('to="/solutions/corporate-legal-teams"'),
    'Hero must link to /solutions/corporate-legal-teams',
  );
  assert.ok(
    content.includes('to="/compare/docketra-vs-excel-whatsapp"'),
    'Hero must link to /compare/docketra-vs-excel-whatsapp',
  );
  assert.ok(
    content.includes('Tailored For Your Practice:'),
    'Hero must have dedicated practice navigation eyebrow',
  );
});

test('Landing page footer contains solutions navigation section', () => {
  const landingPagePath = path.join(uiRoot, 'src', 'components', 'landing', 'LandingPageContent.jsx');
  const content = fs.readFileSync(landingPagePath, 'utf8');

  assert.ok(
    content.includes('aria-label="Practice Solutions Navigation"'),
    'Footer must contain dedicated solutions navigation block',
  );
});

test('BubbleMenu navigation header contains Solutions dropdown and mobile links', () => {
  const bubbleMenuPath = path.join(uiRoot, 'src', 'components', 'common', 'BubbleMenu.jsx');
  const content = fs.readFileSync(bubbleMenuPath, 'utf8');

  assert.ok(
    content.includes('<span>Solutions</span>'),
    'Header navigation bar must include Solutions dropdown trigger',
  );
  assert.ok(
    content.includes('to="/solutions/chartered-accountants"'),
    'Header menu must link to /solutions/chartered-accountants',
  );
  assert.ok(
    content.includes('to="/solutions/company-secretaries"'),
    'Header menu must link to /solutions/company-secretaries',
  );
  assert.ok(
    content.includes('to="/solutions/corporate-legal-teams"'),
    'Header menu must link to /solutions/corporate-legal-teams',
  );
});
