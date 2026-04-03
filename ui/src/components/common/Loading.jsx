/**
 * Loading Spinner Component
 */

import React from 'react';
import { LoadingSpinner } from '../feedback/LoadingSpinner';

export const Loading = ({ message = 'Loading...' }) => {
  return <LoadingSpinner message={message} />;
};
