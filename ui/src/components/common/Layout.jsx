/**
 * Enterprise Layout Component
 * Fixed sidebar + sticky header layout
 */

import React, { useState } from 'react';
import { Link, useNavigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import './Layout.css';

export const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const { isAdmin } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const { firmSlug } = useParams();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Get firmSlug from URL params or user data
  const currentFirmSlug = firmSlug || user?.firmSlug;

  const handleLogout = async () => {
    await logout();
    // Redirect to firm login if firmSlug is available
    if (currentFirmSlug) {
      navigate(`/f/${currentFirmSlug}/login`);
    } else {
      navigate('/login');
    }
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    if (user?.name) {
      return user.name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
    }
    return user?.xID?.substring(0, 2).toUpperCase() || 'U';
  };

  // Simple breadcrumbs from pathname
  const getBreadcrumbs = () => {
    const paths = location.pathname.split('/').filter(Boolean);
    const breadcrumbs = [];
    
    // Skip firm slug
    let startIndex = paths[0] === currentFirmSlug || paths[0] === 'f' ? 2 : 0;
    
    for (let i = startIndex; i < paths.length; i++) {
      const segment = paths[i];
      const label = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
      breadcrumbs.push(label);
    }
    
    return breadcrumbs.length > 0 ? breadcrumbs : ['Dashboard'];
  };

  return (
    <div className="enterprise-layout">
      {/* Fixed Sidebar */}
      <aside className={`enterprise-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="enterprise-sidebar__brand">
          <h1>Docketra</h1>
        </div>
        
        <nav className="enterprise-sidebar__nav">
          <Link
            to={`/${currentFirmSlug}/dashboard`}
            className={`enterprise-sidebar__nav-item ${isActive(`/${currentFirmSlug}/dashboard`) ? 'active' : ''}`}
          >
            Dashboard
          </Link>
          <Link
            to={`/${currentFirmSlug}/global-worklist`}
            className={`enterprise-sidebar__nav-item ${isActive(`/${currentFirmSlug}/global-worklist`) ? 'active' : ''}`}
          >
            Workbasket
          </Link>
          <Link
            to={`/${currentFirmSlug}/worklist`}
            className={`enterprise-sidebar__nav-item ${isActive(`/${currentFirmSlug}/worklist`) ? 'active' : ''}`}
          >
            My Worklist
          </Link>
          <Link
            to={`/${currentFirmSlug}/cases/create`}
            className={`enterprise-sidebar__nav-item ${isActive(`/${currentFirmSlug}/cases/create`) ? 'active' : ''}`}
          >
            Create Case
          </Link>
          {isAdmin && (
            <Link
              to={`/${currentFirmSlug}/admin`}
              className={`enterprise-sidebar__nav-item ${isActive(`/${currentFirmSlug}/admin`) ? 'active' : ''}`}
            >
              Admin
            </Link>
          )}
        </nav>
        
        <div className="enterprise-sidebar__footer">
          <Link to={`/${currentFirmSlug}/profile`} className="enterprise-sidebar__footer-link">
            Settings
          </Link>
          <a href="#" className="enterprise-sidebar__footer-link">
            Help
          </a>
        </div>
      </aside>

      {/* Main Content with Header */}
      <div className={`enterprise-main ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Sticky Header */}
        <header className="enterprise-header">
          <div className="enterprise-header__left">
            <button 
              className="enterprise-header__toggle"
              onClick={toggleSidebar}
              aria-label="Toggle sidebar"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 10H17M3 5H17M3 15H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
            
            <div className="enterprise-header__breadcrumbs">
              {getBreadcrumbs().map((crumb, index, arr) => (
                <React.Fragment key={index}>
                  <span style={{ color: index === arr.length - 1 ? 'var(--text-main)' : 'var(--text-body)' }}>
                    {crumb}
                  </span>
                  {index < arr.length - 1 && (
                    <span className="enterprise-header__breadcrumb-separator">/</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
          
          <div className="enterprise-header__center">
            <div className="enterprise-header__search">
              <input 
                type="text"
                placeholder="Search..."
                className="enterprise-header__search-input"
              />
              <span className="enterprise-header__search-hint">⌘K</span>
            </div>
          </div>
          
          <div className="enterprise-header__right">
            <button className="enterprise-header__icon-btn" aria-label="Notifications">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 2C7.23858 2 5 4.23858 5 7V10L3 12V13H17V12L15 10V7C15 4.23858 12.7614 2 10 2Z" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M8.5 17C8.5 18.1046 9.39543 19 10.5 19C11.6046 19 12.5 18.1046 12.5 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              {/* <span className="enterprise-header__notification-badge"></span> */}
            </button>
            
            <div className="enterprise-header__user" onClick={() => navigate(`/${currentFirmSlug}/profile`)}>
              <div className="enterprise-header__user-avatar">
                {getUserInitials()}
              </div>
              <span className="enterprise-header__user-name">
                {user?.name || user?.xID}
              </span>
            </div>
            
            <button 
              className="btn btn-secondary"
              onClick={handleLogout}
              style={{ minWidth: 'auto', padding: '6px 12px', fontSize: '13px' }}
            >
              Logout
            </button>
          </div>
        </header>

        {/* Content Area */}
        <main className="enterprise-content">
          {children}
        </main>
      </div>
    </div>
  );
};
