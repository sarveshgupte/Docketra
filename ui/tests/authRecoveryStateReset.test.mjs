import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const isUiCwd = path.basename(process.cwd()) === 'ui';
const root = isUiCwd ? process.cwd() : path.join(process.cwd(), 'ui');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const firmLogin = read('src/pages/FirmLoginPage.jsx');
const forgotPassword = read('src/pages/ForgotPasswordPage.jsx');

assert.ok(
  firmLogin.includes("const isPasswordResetSuccess = successMessage === 'Password reset successfully. Please sign in with your new password.';"),
  'Firm login should detect password reset success navigation state.',
);
assert.ok(
  firmLogin.includes('const clearRecoveryAndOtpState = React.useCallback(() => {')
    && firmLogin.includes("setLoginToken('');")
    && firmLogin.includes("setOtp('');")
    && firmLogin.includes("setOtpHint('');")
    && firmLogin.includes('clearPendingLoginState();'),
  'Firm login should clear OTP challenge and pending login state after password reset success.',
);
assert.ok(
  firmLogin.includes("{successMessage && step === 'credentials' && ("),
  'Reset success banner should render only on credential step.',
);
assert.ok(
  firmLogin.includes('navigate(location.pathname + location.search, { replace: true, state: null });'),
  'Firm login should clear stale recovery navigation state after reset success handling.',
);
assert.ok(
  forgotPassword.includes('const resetRecoveryState = () => {')
    && forgotPassword.includes("setResetToken('');")
    && forgotPassword.includes("setOtp('');")
    && forgotPassword.includes('setCooldown(0);'),
  'Forgot password back/reset navigation should clear OTP/reset/token/timer state.',
);
assert.ok(
  forgotPassword.includes("message: 'Password reset successfully. Please sign in with your new password.'"),
  'Forgot password success message should instruct user to sign in with new password.',
);

console.log('authRecoveryStateReset.test.mjs passed');
