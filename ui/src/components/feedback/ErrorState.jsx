import React from 'react';
import { Button } from '../common/Button';
import { Stack } from '../layout/Stack';

export const ErrorState = ({
  title = 'Something went wrong',
  description = 'Unable to load data right now.',
  onRetry,
  retryLabel = 'Retry',
  footer,
}) => (
  <Stack space={12} className="rounded-lg border border-red-200 bg-red-50 p-4" role="alert">
    <h3 className="text-base font-semibold text-red-800">{title}</h3>
    <p className="text-sm text-red-700">{description}</p>
    {onRetry ? (
      <div>
        <Button type="button" variant="primary" onClick={onRetry}>{retryLabel}</Button>
      </div>
    ) : null}
    {footer || null}
  </Stack>
);
