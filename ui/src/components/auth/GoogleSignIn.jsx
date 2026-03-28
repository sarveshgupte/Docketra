import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '../../hooks/useToast';
import { authService } from '../../services/authService';
import { STORAGE_KEYS } from '../../utils/constants';

export function GoogleSignIn({
  className = '',
  onError,
  onSuccess,
  redirectAuthenticated = '/dashboard',
  redirectNotOnboarded = '/complete-profile',
}) {
  const { showError } = useToast();
  const [loading, setLoading] = useState(false);
  const buttonId = useMemo(
    () => `google-signin-btn-${Math.random().toString(36).slice(2, 10)}`,
    []
  );

  const handleCredentialResponse = useCallback(async (response) => {
    if (loading) return;

    const idToken = String(response?.credential || '').trim();
    if (!idToken) {
      const error = new Error('Google login failed: ID token was not returned.');
      showError(error.message);
      onError?.(error);
      return;
    }

    setLoading(true);
    try {
      const result = await authService.googleLogin(idToken);
      if (!result?.success) {
        throw new Error(result?.message || 'Google login failed');
      }

      const { accessToken, isOnboarded } = result.data || {};
      if (!accessToken) {
        throw new Error('Google login failed: access token missing from response.');
      }

      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);

      const callbackResult = await onSuccess?.(result);
      if (callbackResult === false) {
        return;
      }

      const destination = isOnboarded === false ? redirectNotOnboarded : redirectAuthenticated;
      window.location.assign(destination);
    } catch (error) {
      const message = error?.message || 'Google login failed';
      showError(message);
      onError?.(error);
    } finally {
      setLoading(false);
    }
  }, [loading, onError, onSuccess, redirectAuthenticated, redirectNotOnboarded, showError]);

  useEffect(() => {
    const clientId = String(import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
    if (!clientId) {
      const error = new Error('Google Sign-In is unavailable: VITE_GOOGLE_CLIENT_ID is missing.');
      showError(error.message);
      onError?.(error);
      return undefined;
    }

    if (!window.google?.accounts?.id) {
      const error = new Error('Google Sign-In SDK not loaded. Please refresh and try again.');
      showError(error.message);
      onError?.(error);
      return undefined;
    }

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: handleCredentialResponse,
    });

    window.google.accounts.id.renderButton(
      document.getElementById(buttonId),
      {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        width: 300,
      }
    );

    return () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.cancel();
      }
    };
  }, [buttonId, handleCredentialResponse, onError, showError]);

  return (
    <div className={className}>
      <div className={`relative mb-4 ${loading ? 'pointer-events-none opacity-60' : ''}`}>
        <div id={buttonId} />
      </div>
    </div>
  );
}

export default GoogleSignIn;
