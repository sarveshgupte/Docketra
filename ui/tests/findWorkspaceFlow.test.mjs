import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');

const page = read('src/pages/FindWorkspacePage.jsx');
const routes = read('src/routes/PublicRoutes.jsx');

assert.ok(page.includes("xid.trim().toUpperCase()"), 'xID should be normalized by trim + uppercase before lookup.');
assert.ok(page.includes('validateXID(normalizedXid)'), 'xID format validation should be preserved.');
assert.ok(page.includes('navigate(`/${firmSlug}/login`)'), 'Successful lookup should redirect internally to /{firmSlug}/login.');
assert.equal(/window\.location\.(href|assign|replace)/.test(page), false, 'Find workspace should not use external location redirects.');

assert.ok(routes.includes('<Route path="/find-workspace" element={<FindWorkspacePage />} />'), '/find-workspace route must remain wired.');
assert.ok(routes.includes('<Route path="/signup" element={<MarketingSignupPage />} />'), '/signup route must remain unchanged.');
assert.ok(routes.includes('<Route path="/:firmSlug/login" element={<FirmLoginPage />} />'), '/:firmSlug/login route must remain unchanged.');
assert.ok(routes.includes('<Route path="/superadmin/login" element={<LoginPage />} />'), '/superadmin/login route must remain unchanged.');
assert.ok(page.includes('variant="primary"'), 'Continue to workspace submit button must use primary variant.');

const signupPage = read('src/pages/marketing/Signup.jsx');
assert.equal(signupPage.includes("navigate('/find-workspace'"), false, '/signup must not redirect authenticated users away to /find-workspace.');

console.log('findWorkspaceFlow.test.mjs passed');
