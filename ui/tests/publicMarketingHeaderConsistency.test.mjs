import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');

const sharedHeader = read('src/components/marketing/PublicMarketingHeader.jsx');
const navbar = read('src/components/layout/Navbar.jsx');
const landing = read('src/components/landing/LandingPageContent.jsx');
const appLayout = read('src/components/routing/AppLayout.jsx');
const publicRoutes = read('src/routes/PublicRoutes.jsx');

for (const label of ['Why', 'Product', 'Workflow', 'Pilot readiness', 'Trust', 'Workspace login', 'Start managing work']) {
  assert.ok(sharedHeader.includes(label), `Shared header missing canonical label: ${label}`);
}

for (const stale of ['Features', 'How it Works', 'Use Cases', 'Pricing', 'Security', 'About', 'Create your workspace']) {
  assert.equal(sharedHeader.includes(stale), false, `Shared header should not include stale label: ${stale}`);
}

assert.ok(navbar.includes("export default PublicMarketingHeader;"), 'Navbar should delegate to the shared PublicMarketingHeader component.');
assert.ok(landing.includes('<PublicMarketingHeader />'), 'Homepage should use the shared PublicMarketingHeader component.');
assert.ok(appLayout.includes('<Navbar />'), 'Marketing layout should render Navbar so public pages reuse the shared header.');
assert.ok(publicRoutes.includes('<Route path="/find-workspace" element={<FindWorkspacePage />} />'), 'Find workspace route must remain public.');

console.log('publicMarketingHeaderConsistency.test.mjs passed');
