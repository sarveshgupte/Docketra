import React from 'react';

const GAP_CLASS = {
  4: 'gap-1',
  8: 'gap-2',
  12: 'gap-3',
  16: 'gap-4',
  24: 'gap-6',
  32: 'gap-8',
};

export const Stack = ({ as: Component = 'div', space = 16, className = '', children, ...props }) => {
  const gapClass = GAP_CLASS[space] || GAP_CLASS[16];
  return (
    <Component className={`flex flex-col ${gapClass} ${className}`.trim()} {...props}>
      {children}
    </Component>
  );
};
