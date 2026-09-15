import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const uiPublicDir = path.resolve('public');
const uiIndexHtml = path.resolve('index.html');

test('Favicon assets exist in ui/public directory', () => {
  const requiredFiles = [
    'favicon.svg',
    'favicon.ico',
    'favicon-16x16.png',
    'favicon-32x32.png',
    'favicon-48x48.png',
    'apple-touch-icon.png',
    'android-chrome-192x192.png',
    'android-chrome-512x512.png',
  ];

  for (const file of requiredFiles) {
    const filePath = path.join(uiPublicDir, file);
    assert.ok(fs.existsSync(filePath), `${file} must exist in ui/public`);
    const stat = fs.statSync(filePath);
    assert.ok(stat.size > 0, `${file} must not be empty`);
  }
});

test('ui/index.html includes SEO favicon and apple-touch-icon links', () => {
  const content = fs.readFileSync(uiIndexHtml, 'utf8');

  assert.match(
    content,
    /<link[^>]+rel=["']icon["'][^>]+href=["']\/favicon\.svg["']/,
    'index.html must link to /favicon.svg',
  );
  assert.match(
    content,
    /<link[^>]+rel=["']alternate icon["'][^>]+href=["']\/favicon-32x32\.png["']/,
    'index.html must link to /favicon-32x32.png',
  );
  assert.match(
    content,
    /<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']\/apple-touch-icon\.png["']/,
    'index.html must link to /apple-touch-icon.png',
  );
  assert.match(
    content,
    /<meta[^>]+name=["']theme-color["'][^>]+content=["']#0f172a["']/,
    'index.html theme-color must match Docketra dark slate brand palette',
  );
});

test('ui/public/manifest.json contains configured icons and branding', () => {
  const manifestPath = path.join(uiPublicDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  assert.equal(manifest.name, 'Docketra');
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 3, 'manifest must have icon definitions');
  const hasTouchIcon = manifest.icons.some((i) => i.src === '/apple-touch-icon.png');
  const has32Icon = manifest.icons.some((i) => i.src === '/favicon-32x32.png');
  assert.ok(hasTouchIcon, 'manifest must include apple-touch-icon');
  assert.ok(has32Icon, 'manifest must include 32x32 icon');
});
