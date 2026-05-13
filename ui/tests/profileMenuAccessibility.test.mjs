import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');

const layoutSource = read('src/components/common/Layout.jsx');

assert.ok(
  layoutSource.includes('className="enterprise-header__profile"'),
  'Layout profile menu toggle button should exist.',
);

assert.ok(
  layoutSource.includes('aria-label="User profile menu"'),
  'Profile menu toggle must expose an accessible name for assistive technology.',
);

console.log('profileMenuAccessibility.test.mjs passed');
