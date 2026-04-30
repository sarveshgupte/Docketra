/**
 * Authentication Service
 */

import api from './api';
import { SESSION_KEYS, STORAGE_KEYS } from '../utils/constants';
import { authApi } from '../api/auth.api';

export const authService = {
  setSessionTokens: (payload = {}) => {
    const { data: userData = {} } = payload;

    if (userData?.firmSlug) {
      localStorage.setItem(STORAGE_KEYS.FIRM_SLUG, userData.firmSlug);
    } else {
      localStorage.removeItem(STORAGE_KEYS.FIRM_SLUG);
    }
  },

  /**
   * Login with xID and password
   * Backend expects payload key as 'xID' (uppercase 'D')
   */
  login: async (identifier, password, endpoint = '/superadmin/login') => {
    // Send xID only (no email login supported)
    const payload = {
      xID: identifier,
      password: password || ''
    };
    
    const response = await api.post(endpoint, payload);
    
    if (response.data.success) {
      authService.setSessionTokens(response.data);
    }
    // Don't store anything if login fails or requires password change
    
    return response.data;
  },

  /**
   * Start signup flow (OTP send)
   */
  signup: async ({ name, email, password, firmName, phone }) => {
    const response = await authApi.signupInit({
      name,
      email,
      password,
      firmName,
      phone,
    });
    return response;
  },

  /**
   * Verify signup OTP and create account
   */
  verifySignup: async ({ email, otp }) => {
    const response = await authApi.signupVerify({
      email,
      otp,
    });
    return response;
  },

  /**
   * Resend signup OTP
   */
  resendSignupOtp: async (email) => {
    return authApi.signupResendOtp(email);
  },

  resendCredentials: async (email) => {
    return authApi.resendCredentials(email);
  },

  /**
   * Logout
   */
  logout: async (preserveFirmSlug = false) => {
    const firmSlugToPreserve = preserveFirmSlug
      ? localStorage.getItem(STORAGE_KEYS.FIRM_SLUG)
      : null;

    try {
      await api.post('/auth/logout');
    } finally {
      sessionStorage.removeItem(SESSION_KEYS.PENDING_LOGIN_TOKEN);
      sessionStorage.removeItem(SESSION_KEYS.PENDING_LOGIN_FIRM);
      sessionStorage.removeItem(SESSION_KEYS.POST_LOGIN_RETURN_TO);
      if (!firmSlugToPreserve) {
        localStorage.removeItem(STORAGE_KEYS.FIRM_SLUG);
      } else {
        localStorage.setItem(STORAGE_KEYS.FIRM_SLUG, firmSlugToPreserve);
      }
    }
  },

  /**
   * Change password
   */
  changePassword: async (currentPassword, newPassword) => {
    const response = await api.post('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    return response.data;
  },

  /**
   * Change password with xID (for users with mustChangePassword flag)
   */
  changePasswordWithXID: async (xID, currentPassword, newPassword) => {
    const response = await api.post('/auth/change-password', {
      xID,
      currentPassword,
      newPassword,
    });
    return response.data;
  },

  /**
   * Set password using token from email
   */
  setPassword: async (token, password) => {
    const response = await api.post('/auth/setup-account', {
      token,
      password,
    });
    return response.data;
  },

  /**
   * Forgot password - Request password reset email
   */
  forgotPassword: async (identifier, firmSlug) => {
    const payload = { identifier };
    if (firmSlug) {
      payload.firmSlug = firmSlug;
    }
    const response = await api.post('/auth/forgot-password', payload);
    return response.data;
  },

  forgotPasswordInit: async (identifier, firmSlug) => {
    const response = await api.post('/auth/forgot-password/init', { identifier, firmSlug });
    return response.data;
  },

  forgotPasswordVerify: async (identifier, firmSlug, otp) => {
    const response = await api.post('/auth/forgot-password/verify', { identifier, firmSlug, otp });
    return response.data;
  },

  forgotPasswordResetWithOtp: async (identifier, firmSlug, resetToken, password) => {
    const response = await api.post('/auth/forgot-password/reset', {
      identifier,
      firmSlug,
      resetToken,
      password,
    });
    return response.data;
  },

  /**
   * Reset password with token (for forgot password flow)
   */
  resetPasswordWithToken: async (token, password) => {
    const response = await api.post('/auth/reset-password-with-token', {
      token,
      password,
    });
    return response.data;
  },

  /**
   * Get user profile
   */
  getProfile: async ({ skipAuthRedirect = false } = {}) => {
    const response = await api.get('/auth/profile', {
      metadata: { skipAuthRedirect },
    });
    return response.data;
  },

  /**
   * Update user profile
   */
  updateProfile: async (profileData) => {
    const response = await api.put('/auth/profile', profileData);
    // User data is managed by AuthContext, not localStorage
    return response.data;
  },

  /**
   * Get current user from storage (deprecated - always returns null)
   * @deprecated User data should be fetched from API via AuthContext
   */
  getCurrentUser: () => {
    return null;
  },

  /**
   * Get current xID from storage (deprecated - always returns null)
   * @deprecated User data should be fetched from API via AuthContext
   */
  getCurrentXID: () => {
    return null;
  },

  /**
   * Refresh access token
   */
  refreshToken: async () => {
    const response = await api.post('/auth/refresh');
    return response.data;
  },
};
