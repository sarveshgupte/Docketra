import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');

const publicContactConfig = read('src/config/publicContact.js');
assert.ok(publicContactConfig.includes('VITE_SUPPORT_EMAIL'), 'Public contact config must read VITE_SUPPORT_EMAIL.');
assert.ok(publicContactConfig.includes('support@docketra.com'), 'Public contact config must include support@docketra.com fallback.');

const publicUiFiles = [
  'src/components/routing/AppLayout.jsx',
  'src/pages/marketing/About.jsx',
  'src/pages/marketing/AcceptableUse.jsx',
  'src/pages/marketing/Contact.jsx',
  'src/pages/marketing/Pricing.jsx',
  'src/pages/marketing/Privacy.jsx',
  'src/pages/marketing/Security.jsx',
  'src/pages/marketing/Terms.jsx',
];

for (const file of publicUiFiles) {
  const content = read(file);
  assert.equal(content.includes('sarveshgupte@gmail.com'), false, `${file} must not include deprecated personal support email.`);
  assert.ok(content.includes('SUPPORT_EMAIL'), `${file} must reference SUPPORT_EMAIL.`);
}

console.log('publicSupportEmailConfig.test.mjs passed');
