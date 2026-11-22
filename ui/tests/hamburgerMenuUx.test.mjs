import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const isRepoRoot = fs.existsSync(path.resolve('ui'));
const uiRoot = isRepoRoot ? path.resolve('ui') : path.resolve('.');

const bubbleMenuPath = path.join(uiRoot, 'src', 'components', 'common', 'BubbleMenu.jsx');
const bubbleMenuCssPath = path.join(uiRoot, 'src', 'components', 'common', 'BubbleMenu.css');

test('BubbleMenu UX: 3-bar hamburger icon and accessible button', () => {
  const jsx = fs.readFileSync(bubbleMenuPath, 'utf8');

  // Must have 3 hamburger bars for true hamburger icon (not equals sign)
  const barMatches = [...jsx.matchAll(/className="hamburger-bar"/g)];
  assert.equal(barMatches.length, 3, 'Hamburger icon must render 3 bars (not 2 lines)');

  // Must have responsive visibility: hidden on desktop, visible on mobile
  assert.ok(jsx.includes('lg:hidden'), 'Hamburger menu toggle must be hidden on desktop (lg:hidden)');

  // Must have accessible toggle labels
  assert.ok(jsx.includes("isMenuOpen ? 'Close navigation menu' : menuAriaLabel"), 'Toggle button must switch accessible name between open and closed states');
  assert.ok(jsx.includes('aria-expanded={isMenuOpen}'), 'Toggle button must manage aria-expanded state');
});

test('BubbleMenu UX: Keyboard navigation, scroll lock, and dismissal', () => {
  const jsx = fs.readFileSync(bubbleMenuPath, 'utf8');

  // Must support Escape key to close
  assert.ok(jsx.includes("e.key === 'Escape'"), 'Must handle Escape key to dismiss the menu');

  // Must lock background body scrolling when open
  assert.ok(jsx.includes("document.body.style.overflow = 'hidden'"), 'Must lock document body overflow when open');

  // Must have backdrop click dismissal
  assert.ok(jsx.includes('handleBackdropClick'), 'Must handle backdrop click to dismiss overlay');

  // Must have explicit close button inside the drawer
  assert.ok(jsx.includes('aria-label="Close menu"'), 'Drawer must include dedicated Close button with accessible label');
});

test('BubbleMenu UX: Desktop inline navigation and code simplification', () => {
  const jsx = fs.readFileSync(bubbleMenuPath, 'utf8');

  // Must provide inline navigation for desktop viewports
  assert.ok(jsx.includes('hidden lg:flex items-center'), 'Desktop navigation links must be rendered inline on large screens');

  // Code simplification: remove heavy GSAP dependency in favor of clean CSS transitions
  assert.equal(jsx.includes("from 'gsap'"), false, 'BubbleMenu should not depend on heavy GSAP animation library');

  // Capitalized canonical labels in default items
  assert.ok(jsx.includes("label: 'Why'"), 'Default items must have proper title casing');
  assert.ok(jsx.includes("label: 'Product'"), 'Default items must have proper title casing');
});

test('BubbleMenu CSS: Clean 3-bar morph, reduced motion, and compact 36px button', () => {
  const css = fs.readFileSync(bubbleMenuCssPath, 'utf8');

  // Must morph 3 bars to X
  assert.ok(css.includes('.menu-btn.open .hamburger-bar:nth-child(1)'), 'CSS must define top bar rotation on open');
  assert.ok(css.includes('.menu-btn.open .hamburger-bar:nth-child(2)'), 'CSS must hide middle bar on open');
  assert.ok(css.includes('.menu-btn.open .hamburger-bar:nth-child(3)'), 'CSS must define bottom bar rotation on open');

  // Must support prefers-reduced-motion
  assert.ok(css.includes('prefers-reduced-motion: reduce'), 'CSS must respect prefers-reduced-motion');

  // 36px compact button size matching header actions
  assert.ok(css.includes('width: 36px'), 'Toggle button width should match standard header action height (36px)');
  assert.ok(css.includes('height: 36px'), 'Toggle button height should match standard header action height (36px)');

  // Responsive desktop hiding
  assert.ok(css.includes('@media (min-width: 1024px)'), 'CSS must define desktop media query for toggle hiding');
  assert.ok(css.includes('display: none'), 'CSS must explicitly hide hamburger toggle on desktop viewports');
});
