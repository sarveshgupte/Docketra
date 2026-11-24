import React, { cloneElement, useEffect, useMemo, useRef, useState } from 'react';

const EASING_MAP = {
  easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
};

const toTransform = (value = {}) => `translateY(${value.y ?? 0}px) scale(${value.scale ?? 1})`;

const MotionElement = ({
  as: Component = 'div',
  children,
  initial = {},
  animate = {},
  whileInView,
  viewport = {},
  exit = {},
  transition = {},
  __motionState = 'animate',
  style,
  ...props
}) => {
  const elementRef = useRef(null);
  const [inView, setInView] = useState(!whileInView);
  const once = viewport?.once ?? false;
  const easing = Array.isArray(transition.ease)
    ? `cubic-bezier(${transition.ease.join(',')})`
    : EASING_MAP[transition.ease] || 'ease';
  const duration = transition.duration ?? 0.25;
  const delay = transition.delay ?? 0;
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;


  useEffect(() => {
    const target = elementRef.current;
    const isDomNode = Boolean(target) && typeof target === 'object' && typeof target.nodeType === 'number';
    if (!whileInView || !isDomNode || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setInView(false);
        }
      },
      { threshold: viewport?.amount ?? 0.1 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [once, viewport?.amount, whileInView]);

  const animateTarget = whileInView !== undefined ? whileInView : animate;

  const stateStyles = {
    initial: {
      opacity: initial.opacity ?? 1,
      transform: toTransform(initial),
    },
    animate: {
      opacity: animateTarget.opacity ?? 1,
      transform: toTransform(animateTarget),
    },
    exit: {
      opacity: exit.opacity ?? 0,
      transform: toTransform(exit),
    },
  };

  const resolved = whileInView && __motionState !== 'exit'
    ? (inView ? stateStyles.animate : stateStyles.initial)
    : (stateStyles[__motionState] || stateStyles.animate);

  return (
    <Component
      ref={elementRef}
      {...props}
      style={{
        ...style,
        ...(prefersReducedMotion ? { opacity: 1, transform: 'none' } : resolved),
        transition: prefersReducedMotion
          ? 'none'
          : `opacity ${duration}s ${easing} ${delay}s, transform ${duration}s ${easing} ${delay}s`,
      }}
    >
      {children}
    </Component>
  );
};

const motionFactoryCache = new Map();

export const motion = new Proxy(
  {},
  {
    get: (_, tagName) => {
      if (!motionFactoryCache.has(tagName)) {
        motionFactoryCache.set(tagName, (props) => <MotionElement as={tagName} {...props} />);
      }
      return motionFactoryCache.get(tagName);
    },
  }
);

export const useReducedMotion = () => {
  const [prefersReduced, setPrefersReduced] = useState(
    () => typeof window !== 'undefined' && Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const listener = (e) => setPrefersReduced(Boolean(e.matches));
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
    mediaQuery.addListener(listener);
    return () => mediaQuery.removeListener(listener);
  }, []);

  return prefersReduced;
};

export const AnimatePresence = ({ children, mode = 'sync' }) => {
  const current = React.Children.only(children);
  const [rendered, setRendered] = useState(current);
  const [exiting, setExiting] = useState(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!rendered || rendered.key === current.key) {
      setRendered(current);
      return;
    }

    setExiting(rendered);
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setExiting(null);
      setRendered(current);
    }, 260);

    return () => clearTimeout(timeoutRef.current);
  }, [current, rendered]);

  const exitingNode = useMemo(() => {
    if (!exiting) return null;
    return cloneElement(exiting, { __motionState: 'exit' });
  }, [exiting]);

  const enteringNode = useMemo(() => cloneElement(current, { __motionState: 'animate' }), [current]);

  if (mode === 'wait' && exitingNode) {
    return exitingNode;
  }

  return (
    <>
      {exitingNode}
      {enteringNode}
    </>
  );
};
