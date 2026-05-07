import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function StorageOAuthSuccessPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const firmSlug = user?.firmSlug || localStorage.getItem('firmSlug');
    if (firmSlug) {
      navigate(`/app/firm/${encodeURIComponent(firmSlug)}/storage-settings?${params.toString()}`, { replace: true });
      return;
    }
    navigate('/app/dashboard', { replace: true });
  }, [location.search, navigate, user?.firmSlug]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--dt-bg-warm)] px-4">
      <p className="text-sm text-[var(--dt-text-muted)]">Finalizing storage connection…</p>
    </div>
  );
}

export default StorageOAuthSuccessPage;
