import fs from 'fs';
import path from 'path';
import assert from 'assert';

const isUiCwd = path.basename(process.cwd()) === 'ui';
const root = isUiCwd
  ? path.resolve(process.cwd(), 'src')
  : path.resolve(process.cwd(), 'ui/src');

const authContextSource = fs.readFileSync(path.join(root, 'contexts', 'AuthContext.jsx'), 'utf8');
const firmLoginSource = fs.readFileSync(path.join(root, 'pages', 'FirmLoginPage.jsx'), 'utf8');
const otpPageSource = fs.readFileSync(path.join(root, 'pages', 'OtpVerificationPage.jsx'), 'utf8');
const forgotPasswordSource = fs.readFileSync(path.join(root, 'pages', 'ForgotPasswordPage.jsx'), 'utf8');
const apiSource = fs.readFileSync(path.join(root, 'services', 'api.js'), 'utf8');

assert(
  authContextSource.includes('const fetchProfile = useCallback(async ({ force = false } = {}) => {'),
  'AuthContext fetchProfile should accept a force option for post-OTP hydration.'
);
assert(
  authContextSource.includes('if (force) {') && authContextSource.includes('authFailureResolvedRef.current = false;'),
  'AuthContext force fetch should clear resolved unauthenticated guard.'
);
assert(
  firmLoginSource.includes('fetchProfile({ force: true })') && firmLoginSource.includes('resolvePostLoginDestination(returnTo, profileResult.data'),
  'Firm OTP login should force profile hydration and validate redirects after OTP verification.'
);
assert(
  otpPageSource.includes('fetchProfile({ force: true })'),
  'OTP verification page should force profile hydration after OTP success.'
);
assert(
  forgotPasswordSource.includes('setResolvedFirmSlug(response.firmSlug);'),
  'Forgot password flow should preserve firmSlug returned by backend.'
);
assert(
  apiSource.includes('forgot-password\\/init') && apiSource.includes('login\\/verify'),
  'Public auth flow matcher should include OTP and forgot-password endpoints.'
);

console.log('auth OTP redirect regression tests passed');
