import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getPostLoginWorkspaceDestination, resolvePostAuthNavigation } from '../src/utils/postAuthNavigation.js';
import { isAlternativeStorageEnabled } from '../src/utils/storageOptions.js';

const uiRoot = process.cwd();
const readUi = (relativePath) => fs.readFileSync(path.resolve(uiRoot, relativePath), 'utf8');

function createStorageMock(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
}

// 1. Verify post-auth onboarding routing behavior for newly signed-up Primary Admin vs completed setup
const originalWindow = globalThis.window;
try {
  globalThis.window = { localStorage: createStorageMock() };

  const newPrimaryAdmin = {
    role: 'PRIMARY_ADMIN',
    firmSlug: 'apex-legal',
    isSetupComplete: false,
    firm: { isSetupComplete: false },
  };
  assert.equal(
    getPostLoginWorkspaceDestination(newPrimaryAdmin, 'apex-legal'),
    '/app/firm/apex-legal/setup',
    'Newly signed-up Primary Admin should land on workspace setup wizard',
  );
  assert.equal(
    resolvePostAuthNavigation({ user: newPrimaryAdmin }),
    '/app/firm/apex-legal/setup',
    'resolvePostAuthNavigation should preserve workspace setup destination before completion',
  );

  // Dismissed setup hint should allow bypassing setup route
  globalThis.window.localStorage.setItem('setupDismissed:apex-legal', 'true');
  assert.equal(
    getPostLoginWorkspaceDestination(newPrimaryAdmin, 'apex-legal'),
    '/app/firm/apex-legal/global-worklist',
    'Dismissed setup hint should route Primary Admin directly to firm global worklist when no personal workbasket is assigned',
  );

  // Non-primary admin should still land on awaiting-admin setup guard while firm setup is pending
  const staffMember = {
    role: 'USER',
    firmSlug: 'apex-legal',
    isSetupComplete: false,
    firm: { isSetupComplete: false },
  };
  assert.equal(
    getPostLoginWorkspaceDestination(staffMember, 'apex-legal'),
    '/app/firm/apex-legal/setup',
    'Invited staff should see awaiting-administrator screen while firm setup is incomplete',
  );

  // Completed setup should route Primary Admin to global worklist regardless of localStorage hint
  globalThis.window.localStorage.removeItem('setupDismissed:apex-legal');
  const onboardedPrimaryAdmin = {
    role: 'PRIMARY_ADMIN',
    firmSlug: 'apex-legal',
    isSetupComplete: true,
    firm: { isSetupComplete: true },
  };
  assert.equal(
    getPostLoginWorkspaceDestination(onboardedPrimaryAdmin, 'apex-legal'),
    '/app/firm/apex-legal/global-worklist',
    'Primary Admin with completed firm setup should land on firm global worklist',
  );
} finally {
  if (originalWindow === undefined) {
    delete globalThis.window;
  } else {
    globalThis.window = originalWindow;
  }
}

// 2. Verify WorkspaceSetupPage.jsx simplified setup completion flow contracts
const workspaceSetupSource = readUi('src/pages/onboarding/WorkspaceSetupPage.jsx');
assert.ok(
  workspaceSetupSource.includes('const finalizeWorkspaceSetup = async'),
  'WorkspaceSetupPage should share setup completion flow via finalizeWorkspaceSetup helper',
);
assert.ok(
  workspaceSetupSource.includes("const handleExitToWorkspace = () => finalizeWorkspaceSetup({ showCompletionToast: true });"),
  'Exit to Workspace action should delegate to finalizeWorkspaceSetup with toast notification',
);
assert.ok(
  workspaceSetupSource.includes('const handleEnterWorkspace = () => finalizeWorkspaceSetup({ includeTourParam: startTour });'),
  'Enter Workspace CTA should delegate to finalizeWorkspaceSetup and preserve tour preference',
);
assert.ok(
  workspaceSetupSource.includes('adminApi.completeFirmSetup') && workspaceSetupSource.includes('fetchProfile({ force: true })'),
  'WorkspaceSetupPage must call completeFirmSetup and force-refresh profile state',
);
assert.ok(
  workspaceSetupSource.includes('connectGoogleDrive(returnPath)')
    && workspaceSetupSource.includes('/app/firm/${firmSlug}/setup?step=2'),
  'Onboarding storage step must initiate Google Drive OAuth with setup return path',
);

// 3. Verify OAuthPostAuthPage.jsx simplified session exchange contracts
const oauthPostAuthSource = readUi('src/pages/OAuthPostAuthPage.jsx');
assert.ok(
  oauthPostAuthSource.includes('const exchangeAndResolveRoute = async'),
  'OAuthPostAuthPage should share token-exchange + profile hydration via exchangeAndResolveRoute helper',
);
assert.ok(
  oauthPostAuthSource.includes("mode === 'signup_pending' && googlePendingToken"),
  'OAuthPostAuthPage must render pending firm-name form when Google signup needs firm details',
);
assert.ok(
  oauthPostAuthSource.includes('authApi.completeGoogleSignup'),
  'OAuthPostAuthPage must submit pending Google signup via completeGoogleSignup',
);

// 4. Verify Marketing Signup.jsx manual + Google flows remain intact
const signupSource = readUi('src/pages/marketing/Signup.jsx');
assert.ok(
  signupSource.includes('handleGoogleSignup') && signupSource.includes('/auth/google/start?'),
  'Signup page must retain Google Workspace OAuth entry point',
);
assert.ok(
  signupSource.includes('PilotAgreementModal') && signupSource.includes('agreedToPilotTerms'),
  'Signup page must enforce Pilot Agreement clickwrap before OTP or Google signup',
);

// 5. Verify non-Google storage options are disabled on Live/main and enabled in CUG
assert.equal(
  isAlternativeStorageEnabled({ env: { VITE_API_BASE_URL: 'https://api.docketra.in/api', VITE_ENABLE_ALT_STORAGE: 'false' }, hostname: 'app.docketshq.com' }),
  false,
  'Live production env must restrict storage options to Google Drive only',
);
assert.equal(
  isAlternativeStorageEnabled({ env: { VITE_API_BASE_URL: 'https://api.docketra.in/api' }, hostname: 'docketra.in' }),
  false,
  'Live domain without explicit flag must default to Google Drive only',
);
assert.equal(
  isAlternativeStorageEnabled({ env: {}, hostname: 'localhost' }),
  false,
  'Default local environment without CUG indicator should mirror Live Google-Drive-only mode',
);
assert.equal(
  isAlternativeStorageEnabled({ env: { VITE_ENABLE_ALT_STORAGE: 'true' }, hostname: 'localhost' }),
  true,
  'Explicit VITE_ENABLE_ALT_STORAGE=true should enable alternative storage options',
);
assert.equal(
  isAlternativeStorageEnabled({ env: { VITE_API_BASE_URL: 'https://docketra-api-cug-1078507569854.us-central1.run.app/api' }, hostname: 'docketra-cug.web.app' }),
  true,
  'CUG deployment environment should keep alternative storage options enabled',
);

const storageSettingsSource = readUi('src/pages/StorageSettingsPage.jsx');
assert.ok(
  workspaceSetupSource.includes('showAltStorageOptions') && workspaceSetupSource.includes('isAlternativeStorageEnabled()'),
  'WorkspaceSetupPage must gate non-Google storage options with showAltStorageOptions',
);
assert.ok(
  storageSettingsSource.includes('showAltStorageOptions') && storageSettingsSource.includes('isAlternativeStorageEnabled()'),
  'StorageSettingsPage must gate OneDrive and Amazon AWS S3 behind showAltStorageOptions',
);

console.log('firmOnboardingUiFlow.test.mjs passed');
