import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Loading } from '../common/Loading';
import { ROUTES } from '../../constants/routes';
import { AUTH_STATES } from '../../contexts/AuthContext';

export const RootRedirect = () => {
  const { isHydrating, authState, resolvePostAuthRoute, user } = useAuth();

  // Wait until auth hydration completes
  if (isHydrating) {
    return <Loading message="Loading application..." />;
  }

  if (authState === AUTH_STATES.UNAUTHENTICATED) {
    return <Navigate to="/" replace />;
  }

  if (authState === AUTH_STATES.ONBOARDING_REQUIRED) {
    return <Navigate to="/complete-profile" replace />;
  }

  return <Navigate to={resolvePostAuthRoute(user)} replace />;
};
