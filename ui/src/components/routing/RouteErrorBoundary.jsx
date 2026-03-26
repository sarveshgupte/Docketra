import React from 'react';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { RouteErrorFallback } from './RouteErrorFallback';

export const RouteErrorBoundary = ({ children, title, message, backTo }) => (
  <ErrorBoundary
    name={title}
    fallback={<RouteErrorFallback title={title} message={message} backTo={backTo} />}
  >
    {children}
  </ErrorBoundary>
);
