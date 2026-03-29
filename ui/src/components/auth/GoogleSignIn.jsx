import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../hooks/useToast';
import { STORAGE_KEYS } from '../../utils/constants';
import api from '../../services/api';

export function GoogleSignIn({
  className = '',
  onError,
  onSuccess,
  redirectAuthenticated = '/dashboard',
  redirectNotOnboarded = '/complete-profile',
}) {
  const navigate = useNavigate();
  const { showError } = useToast();
  const [loading, setLoading] = useState(false);
  const buttonId = useMemo(
    () => `google-signin-btn-${Math.random().toString(36).slice(2, 10)}`,
    []
  );

  const handleCredentialResponse = useCallback(async (credentialResponse) => {
    if (loading) return;

    try {
      setLoading(true);
      const idToken = credentialResponse?.credential;
      if (!idToken) {
        throw new Error('Google login failed: ID token was not returned.');
      }

      const apiResponse = await api.post('/auth/google', { idToken });
      const result = apiResponse?.data;
      if (!result?.success) {
        throw new Error(result?.message || 'Google login failed');
      }

      const { accessToken, isOnboarded } = result.data || result || {};
      if (!accessToken) {
        throw new Error('Google login failed: access token missing from response.');
      }

      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);

      const callbackResult = await onSuccess?.(result);
      if (callbackResult === false) {
        return;
      }

      if (isOnboarded === false) {
        navigate(redirectNotOnboarded, { replace: true });
        return;
      }

      navigate(redirectAuthenticated, { replace: true });
    } catch (error) {
      const message = error?.message || 'Google login failed';
      console.error('Google login error', error);
      showError(message);
      onError?.(error);
    } finally {
      setLoading(false);
    }
  }, [loading, navigate, onError, onSuccess, redirectAuthenticated, redirectNotOnboarded, showError]);

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
      auto_select: false,
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
      <div className={`relative mb-4 ${loading ? 'opacity-60' : ''}`}>
        <div id={buttonId} />
      </div>
    </div>
  );
}

export default GoogleSignIn;
