import './styles/index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { queryClient } from './queryClient';
import { preloadMatchingRoute } from './routes/lazyPages';

const container = document.getElementById('root');
const app = (
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </QueryClientProvider>
  </React.StrictMode>
);

if (container && container.hasChildNodes()) {
  preloadMatchingRoute().finally(() => {
    ReactDOM.hydrateRoot(container, app, {
      onRecoverableError(error, errorInfo) {
        console.error('[HYDRATION_ERROR]', {
          message: error?.message,
          stack: error?.stack,
          digest: errorInfo?.digest,
          componentStack: errorInfo?.componentStack,
        });
      },
    });
  });
} else if (container) {
  ReactDOM.createRoot(container).render(app);
}
