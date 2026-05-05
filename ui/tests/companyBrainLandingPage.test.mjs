import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');

const homePage = read('src/components/landing/LandingPageContent.jsx');

assert.ok(
  homePage.includes('Client-based task and docket management for Indian firms'),
  'Landing hero must reflect MVP positioning.'
);
assert.ok(homePage.includes('Clients'), 'Landing page should mention Clients.');
assert.ok(homePage.includes('Dockets'), 'Landing page should mention Dockets.');
assert.ok(homePage.includes('tasks') || homePage.includes('Work'), 'Landing page should mention Tasks or Work.');
assert.ok(homePage.includes('Workbaskets') || homePage.toLowerCase().includes('routing'), 'Landing page should mention Workbaskets or routing.');

for (const blocked of ['Company Brain', 'Knowledge Library', 'Knowledge Intake', 'CMS', 'relationship graph', 'HubSpot']) {
  assert.equal(homePage.includes(blocked), false, `Landing page must not include blocked marketing term: ${blocked}`);
}


for (const blockedPhrase of ['Firm Memory', 'Relationship continuity', 'firm never starts from zero', 'preserve firm memory', 'relationship intelligence']) {
  assert.equal(homePage.toLowerCase().includes(blockedPhrase.toLowerCase()), false, `Landing page must not include legacy positioning phrase: ${blockedPhrase}`);
}

assert.equal(/import.*vector|import.*embedding|import.*openai|import.*anthropic/i.test(homePage), false, 'Landing page must not import AI/vector/embedding libraries');
assert.ok(homePage.includes('to="/login"') && homePage.includes('to="/signup"'), 'Landing nav must preserve Login and Signup CTAs.');

console.log('companyBrainLandingPage.test.mjs passed');
