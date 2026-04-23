import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { markRouteTransition } from '../../utils/performanceMonitor';

export const RoutePerformanceTracker = () => {
  const location = useLocation();
  const previousPathRef = useRef(`${location.pathname}${location.search || ''}`);
  const transitionStartRef = useRef(performance.now());

  useEffect(() => {
    const nextPath = `${location.pathname}${location.search || ''}`;
    const previousPath = previousPathRef.current;
    const startedAt = transitionStartRef.current;

    requestAnimationFrame(() => {
      const durationMs = performance.now() - startedAt;
      markRouteTransition(previousPath, nextPath, durationMs);
      previousPathRef.current = nextPath;
      transitionStartRef.current = performance.now();
    });
  }, [location.pathname, location.search]);

  return null;
};
