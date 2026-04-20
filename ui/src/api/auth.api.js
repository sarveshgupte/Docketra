import { request } from './apiClient';

export const authApi = {
  getFirmLoginDetails: (firmSlug) =>
    request((http) => http.get(`/${firmSlug}/login`), 'Invalid workspace URL'),

  getFirmPublicDetails: (firmSlug) =>
    request((http) => http.get(`/public/firms/${firmSlug}`), 'Invalid workspace URL'),

  loginInit: ({ firmSlug, xid, password }) =>
    request((http) => http.post('/auth/login/init', { firmSlug, xid, password }), 'Sign-in failed. Please try again.'),

  loginVerify: ({ firmSlug, loginToken, otp }) =>
    request((http) => http.post('/auth/login/verify', { firmSlug, loginToken, otp }), 'Sign-in failed. Please try again.'),

  loginResendOtp: ({ firmSlug, loginToken }) =>
    request((http) => http.post('/auth/login/resend', { firmSlug, loginToken }), 'Unable to resend OTP.'),

  signupInit: ({ name, email, password, firmName, phone }) =>
    request((http) => http.post('/auth/signup/init', { name, email, password, firmName, phone }), 'Signup failed.'),

  signupVerify: ({ email, otp }) =>
    request((http) => http.post('/auth/signup/verify', { email, otp }), 'OTP verification failed.'),

  signupResendOtp: (email) =>
    request((http) => http.post('/auth/signup/resend', { email }), 'Unable to resend signup OTP.'),

  resendCredentials: (email) =>
    request((http) => http.post('/auth/resend-credentials', { email }), 'Unable to resend welcome email.'),
};
