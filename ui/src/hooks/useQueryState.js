// NEW
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export const useQueryState = (defaults = {}) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const query = useMemo(() => {
    const snapshot = { ...defaults };
    Object.keys(defaults).forEach((key) => {
      const value = searchParams.get(key);
      if (value !== null) {
        snapshot[key] = value;
      }
    });
    return snapshot;
  }, [defaults, searchParams]);

  const setQuery = useCallback((updates = {}, options = { replace: true }) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      });
      return next;
    }, options);
  }, [setSearchParams]);

  return { query, setQuery, searchParams };
};
