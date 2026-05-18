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


const marketingHeader = read('src/components/marketing/PublicMarketingHeader.jsx');

const navLinkMatches = [...marketingHeader.matchAll(/\{\s*label:\s*'([^']+)',\s*id:\s*'([^']+)'\s*\}/g)];
const navPairs = navLinkMatches.map(([, label, id]) => ({ label, id }));
const expectedNav = [
  { label: 'Why', id: 'why' },
  { label: 'Product', id: 'product' },
  { label: 'Workflow', id: 'workflow' },
  { label: 'Pilot readiness', id: 'pilot-readiness' },
  { label: 'Trust', id: 'trust' },
];
assert.deepEqual(navPairs, expectedNav, 'Public marketing header should keep canonical landing section mapping.');

const sectionIds = [...homePage.matchAll(/<section\s+id=\"([^\"]+)\"/g)].map((m) => m[1]);
const uniqueSectionIds = new Set(sectionIds);
assert.equal(uniqueSectionIds.size, sectionIds.length, 'Landing page must not reuse duplicate section ids.');

for (const { id } of expectedNav) {
  assert.ok(uniqueSectionIds.has(id), `Nav id #${id} must map to an existing landing section.`);
}

for (const blockedHeroId of ['why', 'product', 'pilot-readiness']) {
  assert.ok(
    homePage.includes(`<section id=\"${blockedHeroId}\"`) && !homePage.includes(`HeroSection id=\"${blockedHeroId}\"`),
    `${blockedHeroId} anchor must not point to hero.`
  );
}


console.log('companyBrainLandingPage.test.mjs passed');
