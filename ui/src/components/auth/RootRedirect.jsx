import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { isSuperAdmin } from '../../utils/authUtils';
import { Loading } from '../common/Loading';
import { ROUTES } from '../../constants/routes';

export const RootRedirect = () => {
  const { isAuthenticated, user, isHydrating } = useAuth();

  // Wait until auth hydration completes
  if (isHydrating) {
    return <Loading message="Loading application..." />;
  }

  // Unauthenticated users go to login
  if (!isAuthenticated) {
    return <Navigate to={ROUTES.SUPERADMIN_LOGIN} replace />;
  }

  // SuperAdmin users go to SuperAdmin dashboard
  if (isSuperAdmin(user)) {
    return <Navigate to={ROUTES.SUPERADMIN_LOGIN} replace />;
  }

  // Firm users go to firm dashboard
  if (user?.firmSlug) {
    return <Navigate to={ROUTES.DASHBOARD(user.firmSlug)} replace />;
  }

  // Fallback safety
  return <Navigate to={ROUTES.SUPERADMIN_LOGIN} replace />;
};
