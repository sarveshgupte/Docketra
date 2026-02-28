import React, { cloneElement, useEffect, useMemo, useRef, useState } from 'react';

const EASING_MAP = {
  easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
};

const toTransform = (value = {}) => `translateY(${value.y ?? 0}px)`;

const MotionDiv = ({
  children,
  initial = {},
  animate = {},
  exit = {},
  transition = {},
  __motionState = 'animate',
  style,
  ...props
}) => {
  const easing = Array.isArray(transition.ease)
    ? `cubic-bezier(${transition.ease.join(',')})`
    : EASING_MAP[transition.ease] || 'ease';
  const duration = transition.duration ?? 0.25;

  const stateStyles = {
    initial: {
      opacity: initial.opacity ?? 1,
      transform: toTransform(initial),
    },
    animate: {
      opacity: animate.opacity ?? 1,
      transform: toTransform(animate),
    },
    exit: {
      opacity: exit.opacity ?? 0,
      transform: toTransform(exit),
    },
  };

  const resolved = stateStyles[__motionState] || stateStyles.animate;

  return (
    <div
      {...props}
      style={{
        ...style,
        ...resolved,
        transition: `opacity ${duration}s ${easing}, transform ${duration}s ${easing}`,
      }}
    >
      {children}
    </div>
  );
};

export const motion = { div: MotionDiv };

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
