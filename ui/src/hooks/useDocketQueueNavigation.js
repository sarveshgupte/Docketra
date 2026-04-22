import { useMemo } from 'react';
import { ROUTES } from '../constants/routes';

const isFirmAppRoute = (value = '') => String(value || '').startsWith('/app/firm/');

const parseReturnToFromQuery = (search = '') => {
  const params = new URLSearchParams(search || '');
  const value = params.get('returnTo');
  return isFirmAppRoute(value) ? value : '';
};

export const useDocketQueueNavigation = ({ location, firmSlug }) => {
  const sourceList = Array.isArray(location.state?.sourceList) ? location.state.sourceList : [];
  const sourceIndex = Number.isFinite(location.state?.index) ? location.state.index : -1;

  const returnTo = useMemo(() => {
    const fromState = location.state?.returnTo;
    if (isFirmAppRoute(fromState)) return fromState;
    const fromQuery = parseReturnToFromQuery(location.search || '');
    if (fromQuery) return fromQuery;
    return ROUTES.CASES(firmSlug);
  }, [firmSlug, location.search, location.state?.returnTo]);

  const hasPrev = sourceList.length > 0 && sourceIndex > 0;
  const hasNext = sourceList.length > 0 && sourceIndex < sourceList.length - 1;

  const getNavigationState = (nextIndex) => ({
    sourceList,
    index: nextIndex,
    returnTo,
  });

  return {
    sourceList,
    sourceIndex,
    returnTo,
    hasPrev,
    hasNext,
    getNavigationState,
  };
};
