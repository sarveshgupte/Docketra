import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { Loading } from '../components/common/Loading';

export const OAuthPostAuthPage = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const error = params.get('error');
    const firmSlug = params.get('firmSlug');

    if (error === 'PASSWORD_SETUP_REQUIRED') {
      const target = '/auth/setup-account';
      navigate(firmSlug ? `${target}?firmSlug=${encodeURIComponent(firmSlug)}` : target, { replace: true });
      return;
    }

    if (error) {
      navigate(firmSlug ? `/${firmSlug}/login` : '/superadmin/login', {
        replace: true,
        state: { message: 'Google sign-in was not completed.', messageType: 'error' },
      });
      return;
    }

    navigate('/google-callback', { replace: true });
  }, [location.search, navigate]);

  return (
    <div className="login-page">
      <Card className="login-card">
        <Loading message="Finalizing sign-in..." />
      </Card>
    </div>
  );
};
