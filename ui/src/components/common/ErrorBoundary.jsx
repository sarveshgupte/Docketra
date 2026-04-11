/**
 * Error Boundary Component
 * Catches rendering errors and displays fallback UI.
 */

import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error(`[${this.props.name || 'ErrorBoundary'}] Caught error:`, error, errorInfo);
    this.setState({ hasError: true, error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback !== undefined) {
        return this.props.fallback;
      }

      return (
        <div
          className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            background: '#f9fafb',
            writingMode: 'horizontal-tb',
            textOrientation: 'mixed',
          }}
        >
          <div
            className="max-w-md w-full bg-white shadow-lg rounded-lg p-8"
            style={{
              width: 'min(32rem, 100%)',
              minWidth: 0,
              background: '#fff',
              borderRadius: '0.75rem',
              padding: '2rem',
              boxShadow: '0 10px 30px rgba(15, 23, 42, 0.15)',
              boxSizing: 'border-box',
            }}
          >
            <div className="text-center" style={{ width: '100%' }}>
              <h1 className="mt-4 text-2xl font-bold text-gray-900" style={{ marginTop: 0, color: '#111827' }}>
                Unable to load this view
              </h1>
              <p className="mt-2 text-gray-600" style={{ color: '#4b5563', overflowWrap: 'break-word' }}>
                A rendering error occurred. Retry now or go back to continue working.
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => window.history.back()}
                className="mt-3 inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
