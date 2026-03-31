import React from 'react';
import { Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { DefaultRoute } from '../components/routing/DefaultRoute';
import { NotFoundPage } from './lazyPages';
import { RouteSuspenseOutlet } from './RouteSuspenseOutlet';

const LEGACY_SLUG_BLOCKLIST = new Set([
  'about',
  'app',
  'auth',
  'change-password',
  'contact',
  'f',
  'features',
  'forgot-password',
  'login',
  'pricing',
  'privacy',
  'reset-password',
  'security',
  'signup',
  'set-password',
  'superadmin',
  'terms',
]);
const FIRM_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DEFAULT_FIRM_SUFFIX = '/dashboard';

const LegacyFirmScopedRedirect = () => {
  const { firmSlug } = useParams();
  const location = useLocation();
  const suffix = location.pathname.replace(`/f/${firmSlug}`, '') || DEFAULT_FIRM_SUFFIX;
  const target = `/app/firm/${firmSlug}${suffix}${location.search || ''}`;
  return <Navigate to={target} replace />;
};

const LegacyFirmRedirect = () => {
  const location = useLocation();
  const suffix = location.pathname.startsWith('/firm') ? location.pathname.slice('/firm'.length) : '';
  const target = `/app/firm${suffix}${location.search || ''}`;
  return <Navigate to={target} replace />;
};

const LegacySlugRedirect = () => {
  const { firmSlug, '*': legacyPath = '' } = useParams();
  const location = useLocation();
  const normalizedFirmSlug = (firmSlug || '').toLowerCase();

  if (!FIRM_SLUG_PATTERN.test(normalizedFirmSlug) || LEGACY_SLUG_BLOCKLIST.has(normalizedFirmSlug)) {
    return <NotFoundPage />;
  }

  const suffix = legacyPath ? `/${legacyPath}` : DEFAULT_FIRM_SUFFIX;
  const target = `/app/firm/${normalizedFirmSlug}${suffix}${location.search || ''}`;
  return <Navigate to={target} replace />;
};

export const LegacyRoutes = () => (
  <Route element={<RouteSuspenseOutlet />}>
    <Route path="/firm/*" element={<LegacyFirmRedirect />} />
    <Route path="/f/:firmSlug/*" element={<LegacyFirmScopedRedirect />} />
    <Route path="/app/firm" element={<DefaultRoute />} />
    <Route path="/:firmSlug/*" element={<LegacySlugRedirect />} />
    <Route path="*" element={<NotFoundPage />} />
  </Route>
);
