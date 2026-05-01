import { isSafeReturnToPath } from './postAuthNavigation.js';

export const buildReturnTo = (location) => {
  if (!location) return '';
  const pathname = typeof location.pathname === 'string' ? location.pathname : '';
  const search = typeof location.search === 'string' ? location.search : '';
  const hash = typeof location.hash === 'string' ? location.hash : '';
  return `${pathname}${search}${hash}`;
};

export const appendReturnTo = (targetPath, returnTo) => {
  if (!targetPath) return targetPath;
  if (!isSafeReturnToPath(returnTo)) return targetPath;
  const [basePath, existingSearch = ''] = targetPath.split('?');
  const query = new URLSearchParams(existingSearch);
  query.set('returnTo', returnTo);
  const serialized = query.toString();
  return serialized ? `${basePath}?${serialized}` : basePath;
};

export const resolvePostLoginDestination = (returnTo, fallbackPath) => {
  if (isSafeReturnToPath(returnTo)) {
    return returnTo;
  }
  return fallbackPath;
};
