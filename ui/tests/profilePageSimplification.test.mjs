import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath) => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const profilePage = read('src/pages/ProfilePage.jsx');

assert.ok(profilePage.includes('Account snapshot.'), 'Profile page should use a short page subtitle.');
assert.ok(profilePage.includes('Workspace account'), 'Profile page should keep a compact identity eyebrow.');
assert.ok(profilePage.includes('Active secure'), 'Profile page should retain the session state callout.');
assert.ok(profilePage.includes("No reporting manager"), 'Profile page should keep the fallback reporting state concise.');
assert.ok(!profilePage.includes('Security & Telemetry Context'), 'Profile page should remove the unnecessary telemetry section.');
assert.ok(!profilePage.includes('Identity Details'), 'Profile page should remove the old settings-style identity card.');
assert.ok(!profilePage.includes('Input label="Full Name"'), 'Profile page should stop rendering read-only form inputs.');
assert.ok(!profilePage.includes('Cloudflare Turnstile Protected'), 'Profile page should not include the removed security explanatory copy.');

console.log('profilePageSimplification.test.mjs passed');
