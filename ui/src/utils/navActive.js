const trimTrailingSlash = (value) => (value.length > 1 ? value.replace(/\/+$/, '') : value);

const splitPathAndSearch = (value = '') => {
  const [pathPart, queryPart = ''] = String(value).split('?', 2);
  return { path: pathPart || '/', search: queryPart };
};

const normalizePath = (value = '') => {
  const pathOnly = splitPathAndSearch(String(value)).path.split('#', 1)[0] || '/';
  return trimTrailingSlash(pathOnly || '/');
};

const isExactOrDescendantPath = (pathname, route) => {
  const normalizedPathname = normalizePath(pathname);
  const normalizedRoute = normalizePath(route);

  return normalizedPathname === normalizedRoute || normalizedPathname.startsWith(`${normalizedRoute}/`);
};

const hasMatchingQuery = (locationValue, item) => {
  if (!item?.activeQuery || typeof item.activeQuery !== 'object') return true;
  const { search } = splitPathAndSearch(locationValue);
  const params = new URLSearchParams(search);
  return Object.entries(item.activeQuery).every(([key, value]) => String(params.get(key) || '') === String(value || ''));
};

export const isNavItemActive = (pathname, item) => {
  if (!item?.to) return false;

  const matchMode = item.activeMatch || 'exactOrDescendant';

  if (matchMode === 'exact') {
    return normalizePath(pathname) === normalizePath(item.to) && hasMatchingQuery(pathname, item);
  }

  const isMatch = isExactOrDescendantPath(pathname, item.to);
  if (!isMatch) return false;
  if (!hasMatchingQuery(pathname, item)) return false;

  const excluded = Array.isArray(item.excludeActiveFor) ? item.excludeActiveFor : [];
  return !excluded.some((route) => isExactOrDescendantPath(pathname, route));
};
