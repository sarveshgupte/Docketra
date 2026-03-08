const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

async function loadResolver() {
  const moduleUrl = pathToFileURL(path.resolve(__dirname, '../ui/src/utils/firmLoginResponse.js')).href;
  return import(moduleUrl);
}

async function shouldSwitchToOtpStepWhenLoginRequiresOtp() {
  const { resolveFirmLoginResponseState } = await loadResolver();
  const state = resolveFirmLoginResponseState({
    success: true,
    otpRequired: true,
    loginToken: 'JWT_TOKEN',
    resendCooldownSeconds: 3,
  });

  assert.deepStrictEqual(state, {
    nextStep: 'otp',
    loginToken: 'JWT_TOKEN',
    resendCooldownSeconds: 3,
  });
}

async function shouldCompleteLoginWhenTokensAreReturned() {
  const { resolveFirmLoginResponseState } = await loadResolver();
  const state = resolveFirmLoginResponseState({
    success: true,
    accessToken: 'access-token',
  });

  assert.deepStrictEqual(state, {
    nextStep: 'authenticated',
  });
}

async function shouldKeepInvalidCredentialErrorsAsErrors() {
  const { resolveFirmLoginResponseState } = await loadResolver();
  const state = resolveFirmLoginResponseState({
    success: false,
  });

  assert.deepStrictEqual(state, {
    nextStep: 'error',
    error: 'Invalid xID or password',
  });
}

async function shouldTreatMissingOtpLoginTokenAsAnError() {
  const { resolveFirmLoginResponseState } = await loadResolver();
  const state = resolveFirmLoginResponseState({
    success: true,
    otpRequired: true,
  });

  assert.deepStrictEqual(state, {
    nextStep: 'error',
    error: 'Unable to start OTP verification. Please try again.',
  });
}

async function run() {
  await shouldSwitchToOtpStepWhenLoginRequiresOtp();
  await shouldCompleteLoginWhenTokensAreReturned();
  await shouldKeepInvalidCredentialErrorsAsErrors();
  await shouldTreatMissingOtpLoginTokenAsAnError();
  console.log('Firm login UI flow tests passed.');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
