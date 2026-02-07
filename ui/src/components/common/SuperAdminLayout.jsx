/**
 * SuperAdmin Layout Component
 * Minimal layout for platform-level management
 */

import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { Loading } from './Loading';
import { FirmSwitcher } from './FirmSwitcher';
import { ImpersonationBanner } from './ImpersonationBanner';
import { superadminService } from '../../services/superadminService';
import { USER_ROLES } from '../../utils/constants';
import './SuperAdminLayout.css';

export const SuperAdminLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { showSuccess, showError } = useToast();
  
  // State for firm impersonation
  const [impersonatedFirm, setImpersonatedFirm] = useState(null);

  const handleLogout = async () => {
    await logout();
    showSuccess('You have been signed out safely.');
    navigate('/login');
  };

  const handleFirmSwitch = (firmData) => {
    setImpersonatedFirm(firmData);
  };

  const handleExitFirm = async () => {
    try {
      const response = await superadminService.exitFirm();
      if (response.success) {
        setImpersonatedFirm(null);
        showSuccess(response.message);
      }
    } catch (error) {
      console.error('Error exiting firm:', error);
      showError('Failed to exit firm context');
    }
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  // Guard: Only render children if user is loaded and is SuperAdmin
  if (user === null || (user?.isSuperAdmin !== true && user?.role !== USER_ROLES.SUPER_ADMIN)) {
    return <Loading message="Preparing platform dashboard..." />;
  }

  return (
    <div className="superadmin-layout">
      <ImpersonationBanner 
        firmName={impersonatedFirm?.firmName}
        onExit={handleExitFirm}
      />
      <nav className="superadmin-layout__nav">
        <div className="superadmin-layout__nav-container">
          <div className="superadmin-layout__brand">
            <h1>Docketra Platform</h1>
            <span className="superadmin-layout__badge">SuperAdmin</span>
          </div>
          <div className="superadmin-layout__nav-links">
            <Link
              to="/superadmin"
              className={`superadmin-layout__nav-link ${isActive('/superadmin') ? 'active' : ''}`}
            >
              Platform Dashboard
            </Link>
            <Link
              to="/superadmin/firms"
              className={`superadmin-layout__nav-link ${isActive('/superadmin/firms') ? 'active' : ''}`}
            >
              Firms
            </Link>
          </div>
          <div className="superadmin-layout__nav-user">
            <FirmSwitcher onFirmSwitch={handleFirmSwitch} />
            <span className="superadmin-layout__user-info">
              {(user?.xID || user?.email || 'SuperAdmin')} (SuperAdmin)
            </span>
            <button onClick={handleLogout} className="neo-button">
              Logout
            </button>
          </div>
        </div>
      </nav>
      <main className="superadmin-layout__main">{children}</main>
    </div>
  );
};
