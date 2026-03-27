import React, { useEffect } from 'react';
import { authService } from '../../services/authService';

export function GoogleSignIn({ onSuccess, onError }) {
  useEffect(() => {
    if (!window.google?.accounts?.id) return undefined;

    const handleCredentialResponse = async (response) => {
      try {
        const idToken = response?.credential;
        if (!idToken) throw new Error('Google credential missing');
        const result = await authService.googleLogin(idToken);
        onSuccess?.(result);
      } catch (error) {
        onError?.(error);
      }
    };

    window.google.accounts.id.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      callback: handleCredentialResponse,
    });

    window.google.accounts.id.renderButton(
      document.getElementById('google-signin-btn'),
      { theme: 'outline', size: 'large', width: 300 }
    );

    return () => {
      const container = document.getElementById('google-signin-btn');
      if (container) container.innerHTML = '';
    };
  }, [onError, onSuccess]);

  return <div id="google-signin-btn" className="flex justify-center" />;
}

export default GoogleSignIn;
