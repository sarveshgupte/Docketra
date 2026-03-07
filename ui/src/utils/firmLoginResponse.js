export const resolveFirmLoginResponseState = (responseData) => {
  if (responseData?.success !== true) {
    return {
      nextStep: 'error',
      error: responseData?.message || 'Invalid xID or password',
    };
  }

  if (responseData.otpRequired === true) {
    if (typeof responseData.loginToken === 'string' && responseData.loginToken.trim()) {
      return {
        nextStep: 'otp',
        loginToken: responseData.loginToken,
      };
    }

    return {
      nextStep: 'error',
      error: 'Unable to start OTP verification. Please try again.',
    };
  }

  if (typeof responseData.accessToken === 'string' && responseData.accessToken.trim()) {
    return {
      nextStep: 'authenticated',
    };
  }

  return {
    nextStep: 'error',
    error: responseData?.message || 'Invalid xID or password',
  };
};
