import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uiRoot = path.resolve(__dirname, '..');

const authApiSource = fs.readFileSync(path.join(uiRoot, 'src', 'api', 'auth.api.js'), 'utf8');
const authServiceSource = fs.readFileSync(path.join(uiRoot, 'src', 'services', 'authService.js'), 'utf8');
const publicRoutesSource = fs.readFileSync(path.join(uiRoot, 'src', 'routes', 'PublicRoutes.jsx'), 'utf8');
const firmLoginPageSource = fs.readFileSync(path.join(uiRoot, 'src', 'pages', 'FirmLoginPage.jsx'), 'utf8');
const forgotPasswordPageSource = fs.readFileSync(path.join(uiRoot, 'src', 'pages', 'ForgotPasswordPage.jsx'), 'utf8');
const authFlowDoc = fs.readFileSync(path.join(uiRoot, '..', 'docs', 'auth', 'AUTH_FLOW_CONTRACT.md'), 'utf8');

assert(authApiSource.includes("/auth/login/init"), 'Auth API must use canonical /auth/login/init endpoint.');
assert(authApiSource.includes("/auth/login/verify"), 'Auth API must use canonical /auth/login/verify endpoint.');
assert(authApiSource.includes("/auth/signup/init"), 'Auth API must use canonical /auth/signup/init endpoint.');
assert(authApiSource.includes("/auth/signup/verify"), 'Auth API must use canonical /auth/signup/verify endpoint.');

assert(authServiceSource.includes("/auth/forgot-password/init"), 'Auth service must use canonical /auth/forgot-password/init endpoint.');
assert(authServiceSource.includes("/auth/forgot-password/verify"), 'Auth service must use canonical /auth/forgot-password/verify endpoint.');
assert(authServiceSource.includes("/auth/forgot-password/reset"), 'Auth service must use canonical /auth/forgot-password/reset endpoint.');
assert(authServiceSource.includes("/auth/logout"), 'Auth service must use canonical /auth/logout endpoint.');
assert(authServiceSource.includes("/auth/refresh"), 'Auth service must use canonical /auth/refresh endpoint.');
assert(authServiceSource.includes("/auth/profile"), 'Auth service must use canonical /auth/profile endpoint.');

assert(firmLoginPageSource.includes('authApi.loginInit'), 'Firm login page must call authApi.loginInit for challenge start.');
assert(firmLoginPageSource.includes('authApi.loginVerify'), 'Firm login page must call authApi.loginVerify for OTP verify.');
assert(forgotPasswordPageSource.includes('forgotPasswordInit'), 'Forgot password page must call forgotPasswordInit.');
assert(forgotPasswordPageSource.includes('forgotPasswordVerify'), 'Forgot password page must call forgotPasswordVerify.');
assert(forgotPasswordPageSource.includes('forgotPasswordResetWithOtp'), 'Forgot password page must call forgotPasswordResetWithOtp.');

assert(publicRoutesSource.includes('path="/app/:firmSlug/login"'), 'Legacy /app/:firmSlug/login route should remain for redirect compatibility.');
assert(publicRoutesSource.includes('Navigate to={`/${firmSlug}/login`} replace'), '/app/:firmSlug/login must redirect to /:firmSlug/login.');
assert(publicRoutesSource.includes('path="/app/:firmSlug/forgot-password"'), 'Legacy /app/:firmSlug/forgot-password route should remain for redirect compatibility.');
assert(publicRoutesSource.includes('Navigate to={`/${firmSlug}/forgot-password`} replace'), '/app/:firmSlug/forgot-password must redirect to /:firmSlug/forgot-password.');

const deprecatedPatterns = [
  '/auth/forgot-password',
  '/auth/send-otp',
  '/auth/verify-otp',
  '/auth/resend-otp',
];

const allowlistMarker = 'AUTH_CONTRACT_ALLOWLIST';
const allowedFiles = new Set(['src/services/storageService.js', 'src/services/authService.js']);

const collectFiles = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...collectFiles(fullPath));
    if (entry.isFile() && /\.(js|jsx|mjs|ts|tsx)$/.test(entry.name)) files.push(fullPath);
  }
  return files;
};

const sourceFiles = collectFiles(path.join(uiRoot, 'src'));

for (const pattern of deprecatedPatterns) {
  for (const filePath of sourceFiles) {
    const relativePath = path.relative(uiRoot, filePath).replaceAll(path.sep, '/');
    const source = fs.readFileSync(filePath, 'utf8');
    if (!source.includes(pattern)) continue;

    const hasAllowlistComment = source.includes(allowlistMarker);
    const documentedLegacy = authFlowDoc.includes(pattern);
    const isAllowedFile = allowedFiles.has(relativePath);

    assert(
      hasAllowlistComment || (documentedLegacy && isAllowedFile),
      `Deprecated auth endpoint ${pattern} found in ${relativePath} without ${allowlistMarker} comment or documented allowlist.`
    );
  }
}

console.log('authEndpointContract.test.mjs passed');
