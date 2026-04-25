/**
 * Authentication Context
 * 
 * New Auth Contract (as of this PR):
 * ===================================
 * localStorage contains ONLY:
 *   - STORAGE_KEYS.FIRM_SLUG (optional, routing hint only)
 * 
 * User data is NEVER stored in localStorage.
 * All user state is hydrated from /api/auth/profile on app mount.
 * The API is the single source of truth for user identity.
 */

import React, { createContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { authService } from '../services/authService';
import { SESSION_KEYS, STORAGE_KEYS } from '../utils/constants';
import { isSuperAdmin } from '../utils/authUtils';
import { queryClient } from '../queryClient';

export const AuthContext = createContext(null);
export const AUTH_STATES = {
  UNAUTHENTICATED: 'unauthenticated',
  AUTHENTICATED: 'authenticated',
  ONBOARDING_REQUIRED: 'onboarding_required',
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isHydrating, setIsHydrating] = useState(true); // Start true, boot effect will resolve it
  const bootHydratedRef = useRef(false);
  const profileFetchAttemptedRef = useRef(false);
  const profileFetchInFlightRef = useRef(false);
  const profileFetchPromiseRef = useRef(null);
  const authFailureResolvedRef = useRef(false);

  useEffect(() => {
    if (bootHydratedRef.current) return;
    bootHydratedRef.current = true;

    fetchProfile()
      .catch((error) => {
        console.error('[AUTH] Profile hydration failed.', error);
      })
      .finally(() => {
        setLoading(false);
        setIsHydrating(false);
      });
  }, []);

  const clearAuthStorage = useCallback((firmSlugToPreserve = null) => {
    try {
      localStorage.removeItem(STORAGE_KEYS.IMPERSONATED_FIRM);
      if (firmSlugToPreserve) {
        localStorage.setItem(STORAGE_KEYS.FIRM_SLUG, firmSlugToPreserve);
      } else {
        localStorage.removeItem(STORAGE_KEYS.FIRM_SLUG);
      }
      sessionStorage.removeItem(SESSION_KEYS.PENDING_LOGIN_TOKEN);
      sessionStorage.removeItem(SESSION_KEYS.PENDING_LOGIN_FIRM);
      sessionStorage.removeItem(SESSION_KEYS.POST_LOGIN_RETURN_TO);
    } catch (error) {
      console.warn('[AUTH] Unable to update storage while clearing auth state.', error);
    }
  }, []);

  const clearPrivateClientState = useCallback(() => {
    try {
      queryClient.clear();
    } catch (_error) {
      // Keep logout resilient even if query cache internals throw.
    }
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('auth:logout'));
    }
  }, []);

  const resetAuthState = useCallback(({ allowProfileRetry = false } = {}) => {
    clearAuthStorage();
    clearPrivateClientState();
    setUser(null);
    setIsAuthenticated(false);
    profileFetchAttemptedRef.current = allowProfileRetry ? false : true;
    profileFetchInFlightRef.current = false;
    profileFetchPromiseRef.current = null;
    authFailureResolvedRef.current = !allowProfileRetry;
  }, [clearAuthStorage, clearPrivateClientState]);

  /**
   * WARNING:
   * This function MUST NOT be called outside AuthContext.
   * Calling it elsewhere will cause auth bootstrap loops.
   */
  const setAuthFromProfile = useCallback((userData) => {
    if (!userData) return;

    const { firmSlug } = userData;

    // Only store firmSlug as a routing hint (optional)
    try {
      if (firmSlug) {
        localStorage.setItem(STORAGE_KEYS.FIRM_SLUG, firmSlug);
      } else {
        localStorage.removeItem(STORAGE_KEYS.FIRM_SLUG);
      }
    } catch (error) {
      console.warn('[AUTH] Unable to update storage while setting profile.', error);
    }

    // Set user state from API data only (never from localStorage)
    setUser(userData);
    
    const isAuth = !!userData && !!userData.role;
    setIsAuthenticated(isAuth);
  }, []);

  const fetchProfile = useCallback(async ({ force = false } = {}) => {
    if (force) {
      authFailureResolvedRef.current = false;
      profileFetchAttemptedRef.current = false;
      profileFetchInFlightRef.current = false;
      profileFetchPromiseRef.current = null;
    }

    if (authFailureResolvedRef.current) {
      console.info('[AUTH] Skipping profile fetch after resolved unauthenticated state.');
      return { success: false, data: null };
    }

    if (profileFetchInFlightRef.current) {
      return profileFetchPromiseRef.current || { success: false, data: null };
    }

    if (profileFetchAttemptedRef.current) {
      return { success: false, data: null };
    }
    profileFetchAttemptedRef.current = true;
    profileFetchInFlightRef.current = true;

    const profileFetchPromise = (async () => {
      // Always fetch from API - no cached user fallback
      const response = await authService.getProfile();

      if (response?.success && response.data) {
        setAuthFromProfile(response.data);
        return { success: true, data: response.data };
      }

      // Profile fetch returned unsuccessful response - clear auth state
      resetAuthState();
      return { success: false, data: null };
    })();

    profileFetchPromiseRef.current = profileFetchPromise;

    try {
      return await profileFetchPromise;

    } catch (err) {
      // Fail fast on auth errors (401) to avoid hidden polling loops
      // 403 means user is authenticated but profile endpoint denied access (shouldn't happen normally)
      const status = err?.response?.status;
      if (status === 401) {
        resetAuthState();
      }
      // For network errors or other failures, still allow the app to continue
      // The app will render login page since user state is null
      return { success: false, data: null, error: err };
    } finally {
      // Hydration completion is handled by the boot-time effect.
      profileFetchInFlightRef.current = false;
      profileFetchPromiseRef.current = null;
    }
  }, [resetAuthState, setAuthFromProfile]);

  const login = useCallback(async (xID, password, endpoint) => {
    try {
      const response = await authService.login(xID, password, endpoint);
      
      if (response.success) {
        authFailureResolvedRef.current = false;
        profileFetchAttemptedRef.current = false;
        profileFetchInFlightRef.current = false;
        profileFetchPromiseRef.current = null;
        // Login successful - session cookies are set by backend
        // Caller should call fetchProfile() to hydrate user data
        return response;
      }

      const errorMessage = response.message || 'Login failed';
      throw new Error(errorMessage);
    } catch (error) {
      resetAuthState({ allowProfileRetry: true });
      throw error;
    }
  }, [resetAuthState]);

  const signup = useCallback(async ({ name, email, password, firmName, phone }) => {
    return authService.signup({
      name,
      email,
      password,
      firmName,
      phone,
    });
  }, []);

  const verifySignup = useCallback(async ({ email, otp }) => {
    return authService.verifySignup({ email, otp });
  }, []);

  const resendSignupOtp = useCallback(async (email) => {
    return authService.resendSignupOtp(email);
  }, []);

  const resendCredentials = useCallback(async (email) => {
    return authService.resendCredentials(email);
  }, []);

  const logout = useCallback(async ({ preserveFirmSlug = false } = {}) => {
    let firmSlugToPreserve = null;
    if (preserveFirmSlug) {
      try {
        firmSlugToPreserve = user?.firmSlug || localStorage.getItem(STORAGE_KEYS.FIRM_SLUG);
      } catch (error) {
        console.warn('[AUTH] Unable to access storage during logout.', error);
      }
    }

    try {
      // Call backend logout endpoint
      await authService.logout(preserveFirmSlug);
    } catch (error) {
      // Even if backend call fails, clear client state locally.
      console.warn('[AUTH] Logout request failed. Finalizing local logout state.');
    } finally {
      // Always clear client-side state
      setUser(null);
      setIsAuthenticated(false);
      clearPrivateClientState();
      authFailureResolvedRef.current = true;
      profileFetchInFlightRef.current = false;
      profileFetchPromiseRef.current = null;

      clearAuthStorage(firmSlugToPreserve);
      try {
        if (typeof window !== 'undefined' && window?.localStorage) {
          window.localStorage.setItem(STORAGE_KEYS.AUTH_LOGOUT_BROADCAST, String(Date.now()));
        }
      } catch (_error) {
        // Multi-tab broadcast is best-effort; local logout already completed.
      }
    }
  }, [user, clearAuthStorage, clearPrivateClientState]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return undefined;
    const onStorageEvent = (event) => {
      if (event.key !== STORAGE_KEYS.AUTH_LOGOUT_BROADCAST || !event.newValue) return;
      setUser(null);
      setIsAuthenticated(false);
      clearAuthStorage();
      clearPrivateClientState();
      authFailureResolvedRef.current = true;
    };
    window.addEventListener('storage', onStorageEvent);
    return () => window.removeEventListener('storage', onStorageEvent);
  }, [clearAuthStorage, clearPrivateClientState]);

  const updateUser = useCallback((userData) => {
    setUser((prev) => {
      const mergedUser = { ...prev, ...userData };

      // Only update firmSlug in localStorage as a routing hint
      try {
        if (mergedUser.firmSlug) {
          localStorage.setItem(STORAGE_KEYS.FIRM_SLUG, mergedUser.firmSlug);
        }
      } catch (error) {
        console.warn('[AUTH] Unable to update storage while updating user.', error);
      }

      return mergedUser;
    });
  }, []);

  const resolveAuthState = useCallback((candidateUser, candidateIsAuthenticated) => {
    if (!candidateIsAuthenticated || !candidateUser) {
      return AUTH_STATES.UNAUTHENTICATED;
    }

    if (isSuperAdmin(candidateUser)) {
      return AUTH_STATES.AUTHENTICATED;
    }

    if (!candidateUser?.firmSlug) {
      return AUTH_STATES.ONBOARDING_REQUIRED;
    }

    return AUTH_STATES.AUTHENTICATED;
  }, []);

  const authState = resolveAuthState(user, isAuthenticated);

  const resolvePostAuthRoute = useCallback((candidateUser = user) => {
    if (!candidateUser) return '/superadmin';
    if (isSuperAdmin(candidateUser)) return '/app/superadmin';
    if (!candidateUser?.firmSlug) return '/complete-profile';
    return `/app/firm/${candidateUser.firmSlug}/dashboard`;
  }, [user]);

  const isAuthResolved = !loading && !isHydrating;

  const value = useMemo(() => ({
    user,
    loading,
    isAuthenticated,
    isHydrating,
    isAuthResolved,
    authState,
    login,
    signup,
    verifySignup,
    resendSignupOtp,
    resendCredentials,
    logout,
    fetchProfile,
    updateUser,
    setAuthFromProfile,
    resolvePostAuthRoute,
  }), [
    user,
    loading,
    isAuthenticated,
    isHydrating,
    isAuthResolved,
    authState,
    login,
    signup,
    verifySignup,
    resendSignupOtp,
    resendCredentials,
    logout,
    fetchProfile,
    updateUser,
    setAuthFromProfile,
    resolvePostAuthRoute,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
