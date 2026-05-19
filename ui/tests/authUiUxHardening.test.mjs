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

const firmLogin = read('src/pages/FirmLoginPage.jsx');
assert.ok(firmLogin.includes("backendMessage.includes('wrong password')"), 'Firm login should map explicit wrong-password backend text.');
assert.ok(firmLogin.includes("backendMessage.includes('incorrect password')"), 'Firm login should map explicit incorrect-password backend text.');
assert.ok(firmLogin.includes("return 'Wrong password.';"), 'Firm login should show "Wrong password." only for password-specific failures.');
assert.ok(firmLogin.includes("backendMessage.includes('invalid xid or password')"), 'Firm login should detect generic invalid xid/password backend message.');
assert.ok(firmLogin.includes("backendMessage.includes('invalid credentials')"), 'Firm login should detect generic invalid credentials backend message.');
assert.ok(firmLogin.includes("return 'Invalid xID or password.';"), 'Firm login should surface generic credential failure without over-claiming password-specific failure.');
assert.ok(firmLogin.includes('return toUserFacingError(error, mapSafeLoginError(error));'), 'Generic 401/403 fallback should still come from mapSafeLoginError.');
assert.ok(firmLogin.includes("if (status === 429) return 'Too many attempts. Please wait before retrying.';"), '429 fallback message behavior should remain unchanged.');
assert.ok(firmLogin.includes("if (status === 423) return 'This workspace is inactive. Contact your admin.';"), '423 fallback message behavior should remain unchanged.');
assert.ok(firmLogin.includes("if (status >= 500) return 'Workspace lookup is temporarily unavailable. Please try again.';"), '5xx fallback message behavior should remain unchanged.');

const signup = read('src/pages/marketing/Signup.jsx');
assert.ok(signup.includes('Send verification code'), 'Signup CTA should use verification-code language.');
assert.ok(signup.includes('auth-header'), 'Signup should use shared auth header primitives.');

console.log('authUiUxHardening.test.mjs passed');
