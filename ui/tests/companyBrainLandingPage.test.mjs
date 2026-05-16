import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');

const homePage = read('src/components/landing/LandingPageContent.jsx');

assert.ok(homePage.includes('The Company Brain for Indian professional firms.'), 'Hero must include Company Brain positioning.');
assert.ok(homePage.includes('CS, CA, law, and compliance teams'), 'Landing page must mention target audience segments.');
assert.ok(homePage.includes('Built for Indian professional firms'), 'Landing page must call out Indian professional firms.');
assert.ok(homePage.includes('to="/signup"') && homePage.includes('Create workspace'), 'Primary CTA must keep signup/create workspace route.');
assert.ok(homePage.includes('to="/find-workspace"') && homePage.includes('Find workspace'), 'Secondary CTA must keep find-workspace route.');

for (const blocked of ['SOC2', 'ISO 27001', 'DPDP certified']) {
  assert.equal(homePage.toUpperCase().includes(blocked.toUpperCase()), false, `Landing page must not claim unsupported compliance certification: ${blocked}`);
}

assert.equal(homePage.includes('Client-based task and docket management for Indian firms'), false, 'Landing page should not keep legacy generic task-manager style hero positioning.');
assert.ok(homePage.includes('Worklist') && homePage.includes('Workbaskets') && homePage.includes('QC Workbaskets'), 'Landing page should keep Work Execution wedge grounded in current product reality.');

console.log('companyBrainLandingPage.test.mjs passed');
