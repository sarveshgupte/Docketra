import React from 'react';

const PAGE_CONTAINER_BASE = 'mx-auto w-full max-w-container px-6';

export const PageContainer = React.forwardRef(
  ({ as: Component = 'div', className = '', children }, ref) => (
    <Component ref={ref} className={`${PAGE_CONTAINER_BASE} ${className}`.trim()}>
      {children}
    </Component>
  )
);

PageContainer.displayName = 'PageContainer';
