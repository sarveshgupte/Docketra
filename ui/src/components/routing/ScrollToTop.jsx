import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

const SCROLL_CACHE_KEY = 'docketra:scroll-positions';

const readScrollCache = () => {
  try {
    return JSON.parse(sessionStorage.getItem(SCROLL_CACHE_KEY) || '{}');
  } catch {
    return {};
  }
};

const writeScrollCache = (cache) => {
  try {
    sessionStorage.setItem(SCROLL_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // best effort only
  }
};

export const ScrollToTop = () => {
  const { pathname, hash, search } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    const routeKey = `${pathname}${search || ''}`;
    if (hash) {
      return;
    }

    if (navigationType === 'POP') {
      const cachedY = Number(readScrollCache()?.[routeKey]);
      if (Number.isFinite(cachedY) && cachedY > 0) {
        window.scrollTo({ top: cachedY, behavior: 'auto' });
        return;
      }
    }

    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname, search, hash, navigationType]);

  useEffect(() => {
    const routeKey = `${pathname}${search || ''}`;
    return () => {
      const cache = readScrollCache();
      cache[routeKey] = window.scrollY || 0;
      writeScrollCache(cache);
    };
  }, [pathname, search]);

  return null;
};
