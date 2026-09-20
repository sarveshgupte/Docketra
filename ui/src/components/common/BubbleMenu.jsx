import { useState, useRef, useEffect, useId } from 'react';
import { Link } from 'react-router-dom';
import { gsap } from 'gsap';

import './BubbleMenu.css';

const DEFAULT_ITEMS = [
  {
    label: 'why',
    href: '#why',
    ariaLabel: 'Why',
    rotation: -2,
    hoverStyles: { bgColor: '#fdf8f2', textColor: '#b45309' }
  },
  {
    label: 'product',
    href: '#product',
    ariaLabel: 'Product',
    rotation: 2,
    hoverStyles: { bgColor: '#fdf8f2', textColor: '#b45309' }
  },
  {
    label: 'workflow',
    href: '#workflow',
    ariaLabel: 'Workflow',
    rotation: -2,
    hoverStyles: { bgColor: '#fdf8f2', textColor: '#b45309' }
  },
  {
    label: 'pilot readiness',
    href: '#pilot-readiness',
    ariaLabel: 'Pilot Readiness',
    rotation: 2,
    hoverStyles: { bgColor: '#fdf8f2', textColor: '#b45309' }
  },
  {
    label: 'trust',
    href: '#trust',
    ariaLabel: 'Trust',
    rotation: -2,
    hoverStyles: { bgColor: '#fdf8f2', textColor: '#b45309' }
  }
];

export default function BubbleMenu({
  logo,
  onMenuClick,
  className,
  style,
  menuAriaLabel = 'Toggle menu',
  menuBg = '#fff',
  menuContentColor = '#111',
  useFixedPosition = false,
  items,
  animationEase = 'back.out(1.2)',
  animationDuration = 0.4,
  staggerDelay = 0.08
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const generatedId = useId();
  const menuId = `bubble-menu-${generatedId}`;

  const overlayRef = useRef(null);
  const bubblesRef = useRef([]);
  const labelRefs = useRef([]);

  const menuItems = items?.length ? items : DEFAULT_ITEMS;
  const containerClassName = ['bubble-menu', useFixedPosition ? 'fixed' : 'absolute', className]
    .filter(Boolean)
    .join(' ');

  const handleToggle = () => {
    const nextState = !isMenuOpen;
    if (nextState) setShowOverlay(true);
    setIsMenuOpen(nextState);
    onMenuClick?.(nextState);
  };

  useEffect(() => {
    const overlay = overlayRef.current;
    const bubbles = bubblesRef.current.filter(Boolean);
    const labels = labelRefs.current.filter(Boolean);

    if (!overlay || !bubbles.length) return;

    if (isMenuOpen) {
      gsap.set(overlay, { display: 'flex' });
      gsap.killTweensOf([...bubbles, ...labels]);
      gsap.set(bubbles, { scale: 0, transformOrigin: '50% 50%' });
      gsap.set(labels, { y: 12, autoAlpha: 0 });

      bubbles.forEach((bubble, i) => {
        const delay = i * staggerDelay + gsap.utils.random(-0.02, 0.02);
        const tl = gsap.timeline({ delay });

        tl.to(bubble, {
          scale: 1,
          duration: animationDuration,
          ease: animationEase
        });
        if (labels[i]) {
          tl.to(
            labels[i],
            {
              y: 0,
              autoAlpha: 1,
              duration: animationDuration,
              ease: 'power3.out'
            },
            `-=${animationDuration * 0.9}`
          );
        }
      });
    } else if (showOverlay) {
      gsap.killTweensOf([...bubbles, ...labels]);
      gsap.to(labels, {
        y: 12,
        autoAlpha: 0,
        duration: 0.15,
        ease: 'power3.in'
      });
      gsap.to(bubbles, {
        scale: 0,
        duration: 0.15,
        ease: 'power3.in',
        onComplete: () => {
          gsap.set(overlay, { display: 'none' });
          setShowOverlay(false);
        }
      });
    }
  }, [isMenuOpen, showOverlay, animationEase, animationDuration, staggerDelay]);

  useEffect(() => {
    const handleResize = () => {
      if (isMenuOpen) {
        const bubbles = bubblesRef.current.filter(Boolean);
        const isDesktop = window.innerWidth >= 900;

        bubbles.forEach((bubble, i) => {
          const item = menuItems[i];
          if (bubble && item) {
            const rotation = isDesktop ? (item.rotation ?? 0) : 0;
            gsap.set(bubble, { rotation });
          }
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMenuOpen, menuItems]);

  return (
    <>
      <nav className={containerClassName} style={style} aria-label="Main navigation">
        <div className="bubble logo-bubble" aria-label="Logo" style={{ background: menuBg }}>
          <span className="logo-content">
            {typeof logo === 'string' ? <img src={logo} alt="Logo" className="bubble-logo" /> : logo}
          </span>
        </div>

        <div className="flex items-center gap-3 pointer-events-auto">
          {/* Desktop action buttons */}
          <div className="hidden md:flex items-center gap-2.5">
            {/* Solutions Dropdown */}
            <div className="relative group">
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 hover:border-slate-300"
              >
                <span>Solutions</span>
                <svg className="h-3.5 w-3.5 text-slate-400 group-hover:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className="absolute right-0 top-full mt-1.5 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Practice Solutions</div>
                <Link
                  to="/solutions/company-secretaries"
                  className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                  <div>
                    <p className="font-bold leading-none text-slate-900">Company Secretaries</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">MCA V3, ROC & Governance</p>
                  </div>
                </Link>
                <Link
                  to="/solutions/chartered-accountants"
                  className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                  <div>
                    <p className="font-bold leading-none text-slate-900">Chartered Accountants</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Tax Audit, GST & Workbaskets</p>
                  </div>
                </Link>
                <Link
                  to="/solutions/corporate-legal-teams"
                  className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-500 shrink-0" />
                  <div>
                    <p className="font-bold leading-none text-slate-900">Corporate Legal Teams</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Intake, Subsidiaries & Litigation</p>
                  </div>
                </Link>
                <div className="my-1 border-t border-slate-100" />
                <Link
                  to="/compare/docketra-vs-excel-whatsapp"
                  className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
                  <div>
                    <p className="font-bold leading-none text-slate-900">vs. Excel & WhatsApp</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Why firms switch to Docketra</p>
                  </div>
                </Link>
              </div>
            </div>

            <Link
              to="/find-workspace"
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-xs font-bold text-slate-700 transition-all hover:bg-slate-100"
            >
              <svg className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span>Find workspace</span>
            </Link>

            <Link
              to="/signup"
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-slate-950 px-4 text-xs font-bold text-white shadow-sm transition-all hover:bg-slate-800"
            >
              <svg className="h-3.5 w-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
              <span>Create workspace</span>
            </Link>
          </div>

          <button
            type="button"
            className={`bubble toggle-bubble menu-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${isMenuOpen ? 'open' : ''}`}
            onClick={handleToggle}
            aria-label={menuAriaLabel}
            aria-pressed={isMenuOpen}
            aria-expanded={isMenuOpen}
            aria-controls={showOverlay ? menuId : undefined}
            style={{ background: menuBg }}
          >
            <span className="menu-line" style={{ background: menuContentColor }} />
            <span className="menu-line short" style={{ background: menuContentColor }} />
          </button>
        </div>
      </nav>
      {showOverlay && (
        <div
          id={menuId}
          ref={overlayRef}
          className={`bubble-menu-items ${useFixedPosition ? 'fixed' : 'absolute'}`}
          aria-hidden={!isMenuOpen}
        >
          <div className="menu-overlay-container">
            <ul className="menu-card-list" role="menu" aria-label="Menu links">
              {menuItems.map((item, idx) => (
                <li key={idx} role="none" className="menu-card-col">
                  <a
                    role="menuitem"
                    href={item.href}
                    aria-label={item.ariaLabel || item.label}
                    className="menu-card-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                    style={{
                      '--item-rot': `${item.rotation ?? 0}deg`,
                      '--card-bg': menuBg,
                      '--card-color': menuContentColor,
                      '--hover-bg': item.hoverStyles?.bgColor || '#f3f4f6',
                      '--hover-color': item.hoverStyles?.textColor || menuContentColor
                    }}
                    ref={el => {
                      if (el) bubblesRef.current[idx] = el;
                    }}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <span
                      className="menu-card-label"
                      ref={el => {
                        if (el) labelRefs.current[idx] = el;
                      }}
                    >
                      {item.label}
                    </span>
                  </a>
                </li>
              ))}
            </ul>

            {/* Mobile action buttons in the overlay */}
            <div className="flex flex-col gap-2.5 mt-5 px-3 md:hidden w-full max-w-[400px] mx-auto pointer-events-auto">
              <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-3 space-y-1 text-xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 px-1">Practice Solutions</p>
                <Link
                  to="/solutions/company-secretaries"
                  className="flex items-center gap-2 rounded-lg p-2 font-bold text-slate-800 hover:bg-white transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  <span>Company Secretaries (PCS)</span>
                </Link>
                <Link
                  to="/solutions/chartered-accountants"
                  className="flex items-center gap-2 rounded-lg p-2 font-bold text-slate-800 hover:bg-white transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span>Chartered Accountants (CA)</span>
                </Link>
                <Link
                  to="/solutions/corporate-legal-teams"
                  className="flex items-center gap-2 rounded-lg p-2 font-bold text-slate-800 hover:bg-white transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                  <span>Corporate Legal Teams</span>
                </Link>
                <Link
                  to="/compare/docketra-vs-excel-whatsapp"
                  className="flex items-center gap-2 rounded-lg p-2 font-bold text-slate-900 bg-white border border-slate-200 shadow-2xs"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                  <span>vs. Excel & WhatsApp</span>
                </Link>
              </div>

              <Link
                to="/signup"
                className="flex h-12 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-bold text-white shadow-sm transition-all hover:bg-slate-800"
                onClick={() => setIsMenuOpen(false)}
              >
                <svg className="h-4 w-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
                <span>Create workspace</span>
              </Link>
              <Link
                to="/find-workspace"
                className="flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50"
                onClick={() => setIsMenuOpen(false)}
              >
                <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
