import React from 'react';

const PAGE_CONTAINER_BASE = 'mx-auto w-full max-w-container px-container-x py-section';

export const PageContainer = React.forwardRef(
  ({ as: Component = 'div', className = '', children }, ref) => (
    <Component ref={ref} className={`${PAGE_CONTAINER_BASE} ${className}`.trim()}>
      {children}
    </Component>
  )
);

PageContainer.displayName = 'PageContainer';
