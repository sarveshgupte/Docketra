import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const read = (p) => fs.readFileSync(path.resolve(process.cwd(), p), 'utf8');

const authPages = [
  'src/pages/LoginPage.jsx',
  'src/pages/FirmLoginPage.jsx',
  'src/pages/ForgotPasswordPage.jsx',
  'src/pages/OtpVerificationPage.jsx',
  'src/pages/ResetPasswordPage.jsx',
  'src/pages/marketing/Signup.jsx',
];
for (const page of authPages) {
  const content = read(page);
  assert.ok(content.includes('auth-wrapper'), `${page} should use shared auth-wrapper layout.`);
  assert.ok(content.includes('auth-card'), `${page} should use shared auth-card layout.`);
}

const forgot = read('src/pages/ForgotPasswordPage.jsx');
assert.ok(forgot.includes("We'll send a verification code if the account exists."), 'Forgot password should keep enumeration-safe copy.');

const otp = read('src/pages/OtpVerificationPage.jsx');
assert.ok(otp.includes('Resend OTP in ${cooldown}s') || otp.includes('Resend OTP in'), 'OTP page should show resend countdown text.');
assert.equal(otp.includes('submitError?.response?.data?.message'), false, 'OTP page must not render raw backend error message text.');

const login = read('src/pages/LoginPage.jsx');
assert.equal(login.includes('errorData?.message ||'), false, 'Login page must avoid raw backend error fallback text.');
assert.ok(login.includes('disabled={loading || !canSubmit}'), 'Login submit button should disable during loading/invalid state.');
assert.ok(login.includes('<div className="auth-footer-links">'), 'Login footer should use shared auth-footer-links.');
assert.equal((login.match(/auth-kicker/g) || []).length, 1, 'Login should render auth kicker only once.');

const signup = read('src/pages/marketing/Signup.jsx');
assert.ok(signup.includes('Send verification code'), 'Signup CTA should use verification-code language.');
assert.ok(signup.includes('auth-header'), 'Signup should use shared auth header primitives.');

console.log('authUiUxHardening.test.mjs passed');
