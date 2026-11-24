import React, { useState, useRef, useEffect, useId, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import './BubbleMenu.css';

const DEFAULT_ITEMS = [
  { label: 'Why', id: 'why', href: '/#why', ariaLabel: 'Why', description: 'Why firms trust DocketsHQ' },
  { label: 'Product', id: 'product', href: '/#product', ariaLabel: 'Product', description: 'Core capabilities & modules' },
  { label: 'Workflow', id: 'workflow', href: '/#workflow', ariaLabel: 'Workflow', description: 'Statutory compliance lifecycle' },
  { label: 'Pilot readiness', id: 'pilot-readiness', href: '/#pilot-readiness', ariaLabel: 'Pilot Readiness', description: 'Security & pilot criteria' },
  { label: 'Trust', id: 'trust', href: '/#trust', ariaLabel: 'Trust', description: 'Data isolation & architecture' },
  { label: 'Pricing', href: '/pricing', ariaLabel: 'Pricing', description: 'Plans & firm pricing' },
];

export default function BubbleMenu({
  logo,
  onMenuClick,
  onItemClick,
  className,
  style,
  menuAriaLabel = 'Toggle navigation menu',
  menuBg = '#fff',
  menuContentColor = '#0f172a',
  useFixedPosition = false,
  items,
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const generatedId = useId();
  const menuId = `mobile-nav-${generatedId}`;
  const toggleButtonRef = useRef(null);
  const overlayRef = useRef(null);
  const drawerRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = items?.length ? items : DEFAULT_ITEMS;
  const containerClassName = [
    'bubble-menu',
    useFixedPosition ? 'fixed' : 'absolute',
    className
  ].filter(Boolean).join(' ');

  const handleToggle = useCallback(() => {
    setIsMenuOpen((prev) => {
      const next = !prev;
      onMenuClick?.(next);
      return next;
    });
  }, [onMenuClick]);

  const handleClose = useCallback(() => {
    setIsMenuOpen(false);
    onMenuClick?.(false);
  }, [onMenuClick]);

  const handleBackdropClick = (e) => {
    if (e.target === overlayRef.current) {
      handleClose();
    }
  };

  const handleItemClick = (e, item) => {
    handleClose();

    if (onItemClick) {
      e.preventDefault();
      onItemClick(item);
      return;
    }

    const href = item.href || (item.id ? `/#${item.id}` : '');
    if (!href) return;

    if (href.startsWith('#') || href.startsWith('/#')) {
      e.preventDefault();
      const sectionId = href.replace(/^\/?#/, '');
      if (location.pathname === '/') {
        const el = document.getElementById(sectionId);
        if (el) {
          const headerOffset = 84;
          const elementPosition = el.getBoundingClientRect().top + window.scrollY;
          window.scrollTo({ top: Math.max(elementPosition - headerOffset, 0), behavior: 'smooth' });
        }
        navigate({ pathname: '/', hash: `#${sectionId}` }, { replace: true });
      } else {
        navigate(`/#${sectionId}`);
      }
      return;
    }

    if (href.startsWith('/') && !href.startsWith('//')) {
      e.preventDefault();
      navigate(href);
    }
  };

  // Keyboard navigation: Escape key closes menu
  useEffect(() => {
    if (!isMenuOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClose();
        toggleButtonRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMenuOpen, handleClose]);

  // Lock background scrolling when mobile menu is open
  useEffect(() => {
    if (isMenuOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isMenuOpen]);

  // Automatically close menu if viewport is resized to desktop width (>= 1024px)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024 && isMenuOpen) {
        handleClose();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMenuOpen, handleClose]);

  return (
    <>
      <nav className={containerClassName} style={style} aria-label="Main navigation">
        <div className="w-full max-w-7xl mx-auto px-4 md:px-6 flex items-center justify-between">
          {/* Brand Logo */}
          <div className="bubble-menu__brand">
            {typeof logo === 'string' ? <img src={logo} alt="DocketsHQ Logo" className="bubble-logo" /> : logo}
          </div>

          {/* Desktop Navigation Links (inline on large screens) */}
          <div className="hidden lg:flex items-center gap-1 xl:gap-2">
            {menuItems.map((item, idx) => {
              const itemHref = item.href || (item.id ? `/#${item.id}` : '');
              const isPageActive = Boolean(itemHref.startsWith('/') && !itemHref.startsWith('/#') && location.pathname === itemHref);
              return (
                <a
                  key={idx}
                  href={itemHref}
                  onClick={(e) => handleItemClick(e, item)}
                  aria-label={item.ariaLabel || item.label}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xs transition-colors ${
                    isPageActive
                      ? 'text-amber-800 bg-amber-50 font-bold'
                      : 'text-slate-600 hover:text-slate-950 hover:bg-slate-100/80'
                  }`}
                >
                  {item.label}
                </a>
              );
            })}

            {/* Solutions Dropdown */}
            <div className="relative group">
              <button
                type="button"
                aria-haspopup="true"
                className="inline-flex h-9 items-center justify-center gap-1 rounded-xs border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
              >
                <span>Solutions</span>
                <svg className="h-3.5 w-3.5 text-slate-400 group-hover:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className="absolute right-0 top-full mt-1 w-64 rounded-sm border border-slate-200 bg-white p-1.5 shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all z-50">
                <div className="px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">Practice Solutions</div>
                <Link
                  to="/solutions/company-secretaries"
                  className="flex items-center gap-2 rounded-xs px-2 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 transition-colors"
                >
                  <span className="h-1.5 w-1.5 rounded-xs bg-amber-500 shrink-0" />
                  <div>
                    <p className="font-bold leading-none text-slate-900">Company Secretaries</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">MCA V3, ROC & Governance</p>
                  </div>
                </Link>
                <Link
                  to="/solutions/chartered-accountants"
                  className="flex items-center gap-2 rounded-xs px-2 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 transition-colors"
                >
                  <span className="h-1.5 w-1.5 rounded-xs bg-blue-500 shrink-0" />
                  <div>
                    <p className="font-bold leading-none text-slate-900">Chartered Accountants</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Tax Audit, GST & Workbaskets</p>
                  </div>
                </Link>
                <Link
                  to="/solutions/corporate-legal-teams"
                  className="flex items-center gap-2 rounded-xs px-2 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 transition-colors"
                >
                  <span className="h-1.5 w-1.5 rounded-xs bg-purple-500 shrink-0" />
                  <div>
                    <p className="font-bold leading-none text-slate-900">Corporate Legal Teams</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Intake, Subsidiaries & Litigation</p>
                  </div>
                </Link>
                <div className="my-1 border-t border-slate-100" />
                <Link
                  to="/compare/docketra-vs-excel-whatsapp"
                  className="flex items-center gap-2 rounded-xs px-2 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 transition-colors"
                >
                  <span className="h-1.5 w-1.5 rounded-xs bg-slate-400 shrink-0" />
                  <div>
                    <p className="font-bold leading-none text-slate-900">vs. Excel & WhatsApp</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Why firms switch to DocketsHQ</p>
                  </div>
                </Link>
              </div>
            </div>
          </div>

          {/* Right Action Buttons + Responsive Hamburger Menu Toggle */}
          <div className="flex items-center gap-2.5">
            {/* Desktop Actions */}
            <div className="hidden sm:flex items-center gap-2">
              <Link
                to="/find-workspace"
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xs border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:border-slate-300"
              >
                <svg className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span>Find workspace</span>
              </Link>

              <Link
                to="/signup"
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xs bg-slate-950 px-3.5 text-xs font-semibold text-amber-400 shadow-xs transition-colors hover:bg-slate-800"
              >
                <svg className="h-3.5 w-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
                <span>Create workspace</span>
              </Link>
            </div>

            {/* Hamburger Button (visible on mobile/tablet, hidden on desktop >= 1024px) */}
            <button
              ref={toggleButtonRef}
              type="button"
              className={`bubble toggle-bubble menu-btn lg:hidden ${isMenuOpen ? 'open' : ''}`}
              onClick={handleToggle}
              aria-label={isMenuOpen ? 'Close navigation menu' : menuAriaLabel}
              title={isMenuOpen ? 'Close navigation menu' : menuAriaLabel}
              aria-pressed={isMenuOpen}
              aria-expanded={isMenuOpen}
              aria-controls={menuId}
              style={{ background: menuBg }}
            >
              <span className="sr-only">{isMenuOpen ? 'Close navigation menu' : menuAriaLabel}</span>
              <div className="hamburger-icon" aria-hidden="true">
                <span className="hamburger-bar" style={{ background: menuContentColor }} />
                <span className="hamburger-bar" style={{ background: menuContentColor }} />
                <span className="hamburger-bar" style={{ background: menuContentColor }} />
              </div>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Drawer Overlay */}
      {isMenuOpen && (
        <div
          id={menuId}
          ref={overlayRef}
          className={`bubble-menu-items ${useFixedPosition ? 'fixed' : 'absolute'}`}
          onClick={handleBackdropClick}
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
        >
          <div
            ref={drawerRef}
            className="mobile-nav-panel"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Title and Close Button */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Navigation</span>
              <button
                type="button"
                onClick={handleClose}
                className="inline-flex h-8 w-8 items-center justify-center rounded-xs text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                aria-label="Close menu"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Primary Section Links */}
            <div className="py-2.5">
              <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-1 px-1">Overview</div>
              <ul className="space-y-0.5" role="menu" aria-label="Menu links">
                {menuItems.map((item, idx) => {
                  const itemHref = item.href || (item.id ? `/#${item.id}` : '');
                  const isPageActive = Boolean(itemHref.startsWith('/') && !itemHref.startsWith('/#') && location.pathname === itemHref);
                  return (
                    <li key={idx} role="none">
                      <a
                        role="menuitem"
                        href={itemHref}
                        aria-label={item.ariaLabel || item.label}
                        className={`flex items-center justify-between rounded-xs px-2.5 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                          isPageActive
                            ? 'bg-amber-50 text-amber-800 font-bold'
                            : 'text-slate-800 hover:bg-slate-50 hover:text-amber-700'
                        }`}
                        onClick={(e) => handleItemClick(e, item)}
                      >
                        <span>{item.label}</span>
                        {item.description && (
                          <span className="text-[10px] font-normal text-slate-400">{item.description}</span>
                        )}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Practice Solutions Section */}
            <div className="pt-2.5 border-t border-slate-100">
              <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-1 px-1">Practice Solutions</div>
              <div className="space-y-1">
                <Link
                  to="/solutions/company-secretaries"
                  className="flex items-center gap-2 rounded-xs px-2.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 transition-colors"
                  onClick={handleClose}
                >
                  <span className="h-1.5 w-1.5 rounded-xs bg-amber-500 shrink-0" />
                  <div>
                    <p className="font-bold leading-none text-slate-900">Company Secretaries (PCS)</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">MCA V3, ROC & Governance</p>
                  </div>
                </Link>
                <Link
                  to="/solutions/chartered-accountants"
                  className="flex items-center gap-2 rounded-xs px-2.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 transition-colors"
                  onClick={handleClose}
                >
                  <span className="h-1.5 w-1.5 rounded-xs bg-blue-500 shrink-0" />
                  <div>
                    <p className="font-bold leading-none text-slate-900">Chartered Accountants (CA)</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Tax Audit, GST & Workbaskets</p>
                  </div>
                </Link>
                <Link
                  to="/solutions/corporate-legal-teams"
                  className="flex items-center gap-2 rounded-xs px-2.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 transition-colors"
                  onClick={handleClose}
                >
                  <span className="h-1.5 w-1.5 rounded-xs bg-purple-500 shrink-0" />
                  <div>
                    <p className="font-bold leading-none text-slate-900">Corporate Legal Teams</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Intake, Subsidiaries & Litigation</p>
                  </div>
                </Link>
                <Link
                  to="/compare/docketra-vs-excel-whatsapp"
                  className="flex items-center gap-2 rounded-xs px-2.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 transition-colors"
                  onClick={handleClose}
                >
                  <span className="h-1.5 w-1.5 rounded-xs bg-slate-400 shrink-0" />
                  <div>
                    <p className="font-bold leading-none text-slate-900">vs. Excel & WhatsApp</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Why firms switch to DocketsHQ</p>
                  </div>
                </Link>
              </div>
            </div>

            {/* Action Buttons in Drawer (visible on mobile) */}
            <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
              <Link
                to="/signup"
                className="flex h-10 items-center justify-center gap-1.5 rounded-xs bg-slate-950 px-4 text-xs font-semibold text-amber-400 shadow-xs transition-colors hover:bg-slate-800"
                onClick={handleClose}
              >
                <svg className="h-3.5 w-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
                <span>Create workspace</span>
              </Link>
              <Link
                to="/find-workspace"
                className="flex h-10 items-center justify-center gap-1.5 rounded-xs border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                onClick={handleClose}
              >
                <svg className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span>Find workspace</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
