import React from 'react';
import { Stack } from '../layout/Stack';

export const LoadingSpinner = ({ message = 'Loading…' }) => (
  <Stack space={16} className="items-center justify-center py-8" role="status" aria-live="polite">
    <div className="neo-spinner" aria-hidden="true" />
    <p className="text-sm text-gray-600">{message}</p>
  </Stack>
);
