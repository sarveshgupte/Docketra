import React, { useEffect, useMemo, useState } from 'react';

const MotionDiv = ({ children, initial = {}, animate = {}, transition = {}, style = {}, ...props }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const transitionStyle = useMemo(() => {
    const duration = transition.duration ?? 0.25;
    const easing = transition.ease === 'easeOut' ? 'cubic-bezier(0, 0, 0.2, 1)' : 'ease';
    return `opacity ${duration}s ${easing}, transform ${duration}s ${easing}`;
  }, [transition.duration, transition.ease]);

  const currentStyle = mounted ? animate : initial;

  return (
    <div
      style={{
        ...style,
        opacity: currentStyle.opacity,
        transform: `translateY(${currentStyle.y ?? 0}px)`,
        transition: transitionStyle,
      }}
      {...props}
    >
      {children}
    </div>
  );
};

export const motion = {
  div: MotionDiv,
};
