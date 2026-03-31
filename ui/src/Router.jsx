/**
 * Router Configuration
 */

import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { PublicRoutes } from './routes/PublicRoutes';
import { ProtectedRoutes } from './routes/ProtectedRoutes';
import { LegacyRoutes } from './routes/LegacyRoutes';

export const Router = () => {
  const location = useLocation();

  return (
    <Routes location={location} key={location.pathname}>
      <PublicRoutes />
      <ProtectedRoutes />
      <LegacyRoutes />
    </Routes>
  );
};
