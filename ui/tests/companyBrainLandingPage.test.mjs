import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');

const homePage = read('src/pages/marketing/HomePage.jsx');
const publicRoutes = read('src/routes/PublicRoutes.jsx');
const protectedRoutes = read('src/routes/ProtectedRoutes.jsx');

// ── Required copy ──────────────────────────────────────────────────────────

assert.ok(
  homePage.includes('Run your firm with memory.'),
  'Landing page must contain hero headline "Run your firm with memory."'
);

assert.ok(
  homePage.includes('Docketra is the Company Brain'),
  'Landing page must contain "Docketra is the Company Brain"'
);

assert.ok(
  homePage.includes('AI off by default'),
  'Landing page must contain trust bullet "AI off by default"'
);

assert.ok(
  homePage.includes('Bring Your Own Storage'),
  'Landing page must contain trust card "Bring Your Own Storage"'
);

assert.ok(
  homePage.includes('Quiet by design. Yours by default.'),
  'Landing page must contain trust section headline "Quiet by design. Yours by default."'
);

assert.ok(
  homePage.includes("Build your firm's memory before it walks out the door."),
  'Landing page must contain final CTA headline'
);

// ── Prohibited copy / patterns ────────────────────────────────────────────

assert.equal(
  homePage.includes('All context synced'),
  false,
  'Landing page must NOT contain "All context synced"'
);

assert.equal(
  homePage.includes('readOnly') || homePage.includes('read-only') && homePage.includes('<input'),
  false,
  'Landing page must NOT contain a readOnly email input'
);

assert.equal(
  homePage.includes("onSubmit={(e) => e.preventDefault()}"),
  false,
  'Landing page must NOT contain a fake onSubmit handler'
);

// ── No AI/vector/embedding infrastructure ────────────────────────────────

// These checks guard against actual imported AI infrastructure, not just copy mentioning the words.
assert.equal(
  /import.*vector|import.*embedding|import.*openai|import.*anthropic/i.test(homePage),
  false,
  'Landing page must NOT import AI/vector/embedding libraries'
);

assert.equal(
  homePage.includes('document extraction'),
  false,
  'Landing page must NOT reference document extraction'
);

// ── Routes remain intact ──────────────────────────────────────────────────

assert.ok(
  publicRoutes.includes('<Route path="/signup" element={<MarketingSignupPage />} />'),
  'Public /signup route must remain registered'
);

assert.ok(
  publicRoutes.includes('<Route path="/:firmSlug/login" element={<FirmLoginPage />} />'),
  'Public /:firmSlug/login route must remain registered'
);

assert.ok(
  publicRoutes.includes('<Route path="/" element={<MarketingHomePage />} />'),
  'Public / route must render MarketingHomePage'
);

assert.ok(
  protectedRoutes.includes('firmSlug'),
  'Protected routes must remain intact'
);

// ── CTA links to real routes, not fake forms ──────────────────────────────

assert.ok(
  homePage.includes('to="/signup"') || homePage.includes(`href="mailto:`),
  'Final CTA must link to /signup or a mailto: — no fake form'
);

console.log('companyBrainLandingPage.test.mjs passed');
