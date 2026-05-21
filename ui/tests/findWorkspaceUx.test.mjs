import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');

const page = read('src/pages/FindWorkspacePage.jsx');
const header = read('src/components/marketing/PublicMarketingHeader.jsx');

assert.ok(page.includes('Find your Docketra workspace'), 'Page should include discovery heading.');
assert.ok(page.includes('Enter your xID') && page.includes('secure login page'), 'Page should clarify xID entry instead of firmSlug entry.');
assert.ok(page.includes('Continue to workspace'), 'Primary button copy should match UX guidance.');
assert.ok(page.includes('Finding workspace…'), 'Loading button copy should match UX guidance.');
assert.ok(page.includes('Contact your firm admin.'), 'xID fallback helper copy should be present.');
assert.ok(page.includes('We never show private user details here'), 'Privacy/trust context copy should be present.');
assert.ok(page.includes('Enter a valid xID, for example X000001.'), 'Friendly validation message should be present.');
assert.equal(page.includes('style={{'), false, 'FindWorkspacePage should not use inline style props.');

assert.ok(header.includes("const isFindWorkspacePage = location.pathname === '/find-workspace';"), 'Header should detect find-workspace route for CTA behavior.');
assert.ok(header.includes('{!isFindWorkspacePage ? <Link to="/find-workspace"'), 'Header should hide duplicate Workspace login CTA on /find-workspace.');

console.log('findWorkspaceUx.test.mjs passed');
