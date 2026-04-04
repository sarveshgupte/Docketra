import React from 'react';

const GAP_CLASS = {
  4: 'gap-1',
  8: 'gap-2',
  12: 'gap-3',
  16: 'gap-4',
  24: 'gap-6',
  32: 'gap-8',
};

const ALIGN_CLASS = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
};

const JUSTIFY_CLASS = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
};

export const Row = ({
  as: Component = 'div',
  align = 'center',
  justify = 'start',
  wrap = false,
  gap = 12,
  className = '',
  children,
  ...props
}) => {
  const alignClass = ALIGN_CLASS[align] || ALIGN_CLASS.center;
  const justifyClass = JUSTIFY_CLASS[justify] || JUSTIFY_CLASS.start;
  const wrapClass = wrap ? 'flex-wrap' : 'flex-nowrap';
  const gapClass = GAP_CLASS[gap] || GAP_CLASS[12];

  return (
    <Component className={`flex ${alignClass} ${justifyClass} ${wrapClass} ${gapClass} ${className}`.trim()} {...props}>
      {children}
    </Component>
  );
};
