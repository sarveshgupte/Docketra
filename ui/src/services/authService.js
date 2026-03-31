/**
 * Authentication Service
 */

import api from './api';
import { ERROR_CODES, STORAGE_KEYS } from '../utils/constants';
import { isAccessTokenOnlyUser } from '../utils/authUtils';

export const authService = {
  setSessionTokens: (payload = {}) => {
    const {
      accessToken,
      refreshToken,
      data: userData = {},
      refreshEnabled,
      isSuperAdmin,
    } = payload;

    if (!accessToken) return;

    const userWithFlags = {
      ...userData,
      refreshEnabled: refreshEnabled !== undefined ? refreshEnabled : userData.refreshEnabled,
      isSuperAdmin: isSuperAdmin !== undefined ? isSuperAdmin : userData.isSuperAdmin,
    };

    const accessTokenOnly = isAccessTokenOnlyUser(userWithFlags);
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    if (!accessTokenOnly && refreshToken) {
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    } else {
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    }

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
    const response = await api.post('/auth/signup/init', {
      name,
      email,
      password,
      firmName,
      phone,
    });
    return response.data;
  },

  /**
   * Verify signup OTP and create account
   */
  verifySignup: async ({ email, otp }) => {
    const response = await api.post('/auth/signup/verify', {
      email,
      otp,
    });
    return response.data;
  },

  /**
   * Resend signup OTP
   */
  resendSignupOtp: async (email) => {
    const response = await api.post('/auth/signup/resend', { email });
    return response.data;
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
      localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      
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
  forgotPassword: async (email, firmSlug) => {
    const payload = { email };
    if (firmSlug) {
      payload.firmSlug = firmSlug;
    }
    const response = await api.post('/auth/forgot-password', payload);
    return response.data;
  },

  forgotPasswordInit: async (email, firmSlug) => {
    const response = await api.post('/auth/forgot-password/init', { email, firmSlug });
    return response.data;
  },

  forgotPasswordVerify: async (email, firmSlug, otp) => {
    const response = await api.post('/auth/forgot-password/verify', { email, firmSlug, otp });
    return response.data;
  },

  forgotPasswordResetWithOtp: async (email, firmSlug, resetToken, password) => {
    const response = await api.post('/auth/forgot-password/reset', {
      email,
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
  getProfile: async () => {
    const response = await api.get('/auth/profile');
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
   * Check if user is authenticated
   */
  isAuthenticated: () => {
    return !!localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  },
  
  /**
   * Refresh access token
   */
  refreshToken: async () => {
    const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    
    // If no refresh token, this is an access-token-only session
    if (!refreshToken) {
      const error = new Error('Refresh not supported for this session');
      error.code = ERROR_CODES.REFRESH_NOT_SUPPORTED;
      error.response = { data: { code: ERROR_CODES.REFRESH_NOT_SUPPORTED } };
      throw error;
    }
    
    const response = await api.post('/auth/refresh', {
      refreshToken,
    });
    
    if (response.data.success) {
      const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data;
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, newAccessToken);
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, newRefreshToken);
    }
    
    return response.data;
  },
};
