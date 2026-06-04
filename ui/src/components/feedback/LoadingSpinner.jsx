import React from 'react';
import { Stack } from '../layout/Stack';

export const LoadingSpinner = ({ message = 'Loading…' }) => (
  <Stack space={16} className="items-center justify-center py-8" role="status" aria-live="polite">
    <div className="relative flex items-center justify-center" aria-hidden="true">
      {/* Outer spinning gradient ring */}
      <div className="w-10 h-10 rounded-full border-3 border-indigo-100 border-t-indigo-600 animate-spin" />
      {/* Inner pulsing indicator */}
      <div className="absolute w-3.5 h-3.5 rounded-full bg-indigo-500/80 animate-pulse" />
    </div>
    <p className="text-sm font-medium text-slate-500 tracking-wide animate-pulse">{message}</p>
  </Stack>
);
