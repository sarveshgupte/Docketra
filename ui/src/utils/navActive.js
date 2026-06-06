import { isRoleCompatibleRoute, isSafeReturnToPath } from './returnToSafety.js';

const trimTrailingSlash = (value) => (value.length > 1 ? value.replace(/\/+$/, '') : value);

const normalizePath = (value = '') => {
  const pathOnly = String(value).split(/[?#]/, 1)[0] || '/';
  return trimTrailingSlash(pathOnly || '/');
};

const parseRoute = (value = '') => {
  const [pathPart = '', queryString = ''] = String(value || '').split('?');
  return {
    path: normalizePath(pathPart || '/'),
    query: new URLSearchParams(queryString || ''),
  };
};

const isExactOrDescendantPath = (pathname, route) => {
  const normalizedPathname = normalizePath(pathname);
  const normalizedRoute = normalizePath(route);

  return normalizedPathname === normalizedRoute || normalizedPathname.startsWith(`${normalizedRoute}/`);
};

const matchesExcludedRoute = (pathname, search = '', excludedRoute = '') => {
  const current = parseRoute(`${pathname || ''}${search || ''}`);
  const target = parseRoute(excludedRoute);
  const hasQueryConstraint = [...target.query.keys()].length > 0;

  if (hasQueryConstraint) {
    if (current.path !== target.path) return false;
    return [...target.query.entries()].every(([key, value]) => current.query.get(key) === value);
  }

  return isExactOrDescendantPath(pathname, excludedRoute);
};

export const resolveNavContextLocation = (pathname = '', search = '', firmSlug = '') => {
  const normalizedFirmSlug = String(firmSlug || '').trim();
  if (!normalizedFirmSlug) return { pathname, search };

  const normalizedPathname = normalizePath(pathname);
  const docketDetailPrefix = normalizePath(`/app/firm/${normalizedFirmSlug}/dockets`);
  const isDocketDetailRoute =
    normalizedPathname === docketDetailPrefix
    || normalizedPathname.startsWith(`${docketDetailPrefix}/`);

  if (!isDocketDetailRoute) return { pathname, search };

  const returnTo = new URLSearchParams(search || '').get('returnTo');
  if (!isSafeReturnToPath(returnTo)) return { pathname, search };
  if (!isRoleCompatibleRoute(returnTo, { isSuperAdminUser: false, firmSlug: normalizedFirmSlug })) {
    return { pathname, search };
  }

  const [returnPath = '', returnQuery = ''] = String(returnTo).split('?');
  return {
    pathname: normalizePath(returnPath || '/'),
    search: returnQuery ? `?${returnQuery}` : '',
  };
};

export const isNavItemActive = (pathname, item) => {
  if (!item?.to) return false;

  const matchMode = item.activeMatch || 'exactOrDescendant';
  if (matchMode === 'exactWithQuery') {
    return false;
  }

  if (matchMode === 'exact') {
    return normalizePath(pathname) === normalizePath(item.to);
  }

  const isMatch = isExactOrDescendantPath(pathname, item.to);
  if (!isMatch) return false;

  const excluded = Array.isArray(item.excludeActiveFor) ? item.excludeActiveFor : [];
  return !excluded.some((route) => matchesExcludedRoute(pathname, '', route));
};

export const isNavItemActiveWithLocation = (pathname, search = '', item) => {
  if (!item?.to) return false;
  const current = `${pathname || ''}${search || ''}`;
  if (item.activeMatch === 'exactWithQuery') {
    return current === item.to;
  }

  const baseMatch = isNavItemActive(pathname, item);
  if (!baseMatch) return false;

  const excluded = Array.isArray(item.excludeActiveFor) ? item.excludeActiveFor : [];
  return !excluded.some((route) => matchesExcludedRoute(pathname, search, route));
};
