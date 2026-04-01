/**
 * Router Configuration
 */

import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { PublicRoutes } from './routes/PublicRoutes';
import { ProtectedRoutes } from './routes/ProtectedRoutes';
import { LegacyRoutes } from './routes/LegacyRoutes';

export const Router = () => {
  return (
    <Routes>
      {PublicRoutes()}
      {ProtectedRoutes()}
      {LegacyRoutes()}
    </Routes>
  );
};
