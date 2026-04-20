const trimTrailingSlash = (value) => (value.length > 1 ? value.replace(/\/+$/, '') : value);

const normalizePath = (value = '') => {
  const pathOnly = String(value).split(/[?#]/, 1)[0] || '/';
  return trimTrailingSlash(pathOnly || '/');
};

const isExactOrDescendantPath = (pathname, route) => {
  const normalizedPathname = normalizePath(pathname);
  const normalizedRoute = normalizePath(route);

  return normalizedPathname === normalizedRoute || normalizedPathname.startsWith(`${normalizedRoute}/`);
};

export const isNavItemActive = (pathname, item) => {
  if (!item?.to) return false;

  const matchMode = item.activeMatch || 'exactOrDescendant';

  if (matchMode === 'exact') {
    return normalizePath(pathname) === normalizePath(item.to);
  }

  const isMatch = isExactOrDescendantPath(pathname, item.to);
  if (!isMatch) return false;

  const excluded = Array.isArray(item.excludeActiveFor) ? item.excludeActiveFor : [];
  return !excluded.some((route) => isExactOrDescendantPath(pathname, route));
};

