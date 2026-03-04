/**
 * Google OAuth Callback Handler
 * Stores tokens from backend redirect and routes user appropriately.
 */

import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { STORAGE_KEYS, USER_ROLES } from '../utils/constants';
import { useAuth } from '../hooks/useAuth';
import './LoginPage.css';

export const GoogleCallbackPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const { fetchProfile } = useAuth();
  const params = new URLSearchParams(location.search);
  const firmSlugFromQuery = params.get('firmSlug');
  const errorParam = params.get('error');

  useEffect(() => {
    if (errorParam) {
      setError(errorParam);
      return;
    }

    if (firmSlugFromQuery) {
      localStorage.setItem(STORAGE_KEYS.FIRM_SLUG, firmSlugFromQuery);
    }
  }, [firmSlugFromQuery, errorParam]);

  useEffect(() => {
    if (errorParam) return;

    let isMounted = true;
    const hydrate = async () => {
      const result = await fetchProfile();
      if (!isMounted) return;

      if (result?.success && result.data) {
        const effectiveFirmSlug = firmSlugFromQuery || result.data.firmSlug;
        if (result.data.role === USER_ROLES.SUPER_ADMIN) {
          navigate('/app/superadmin', { replace: true });
          return;
        }
        if (effectiveFirmSlug) {
          navigate(`/app/firm/${effectiveFirmSlug}/dashboard`, { replace: true });
          return;
        }
        setError('Firm context missing.');
        return;
      }

      if (result?.error?.response?.status === 401) {
        setError('Google sign-in session could not be established. Please sign in again.');
        return;
      }
      setError('Google sign-in session could not be established. Please try again.');
    };

    hydrate();
    return () => {
      isMounted = false;
    };
  }, [errorParam, fetchProfile, firmSlugFromQuery, navigate]);

  return (
    <div className="login-page">
      <Card className="login-card">
        {error ? (
          <div className="error-message">{error}</div>
        ) : (
          <Loading message="Completing Google sign-in..." />
        )}
      </Card>
    </div>
  );
};
