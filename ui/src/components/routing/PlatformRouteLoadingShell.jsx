import React from 'react';

const PlatformLoadingLine = ({ width }) => (
  <div
    className="animate-pulse rounded bg-gray-200"
    style={{ height: '0.875rem', width }}
    aria-hidden="true"
  />
);

export const PlatformRouteLoadingShell = () => (
  <div className="route-loading-shell" aria-busy="true" aria-live="polite" aria-label="Loading workspace page">
    <div className="route-loading-shell__progress" aria-hidden="true" />
    <div className="route-loading-shell__content">
      <section className="grid gap-4" aria-hidden="true">
        <PlatformLoadingLine width="10rem" />
        <PlatformLoadingLine width="18rem" />
        <div className="grid gap-3 rounded-xl border border-gray-200 p-4">
          <PlatformLoadingLine width="100%" />
          <PlatformLoadingLine width="90%" />
          <PlatformLoadingLine width="75%" />
          <PlatformLoadingLine width="60%" />
        </div>
      </section>
      <p className="mt-3 text-xs text-gray-500">
        Loading your workspace…
      </p>
    </div>
  </div>
);
