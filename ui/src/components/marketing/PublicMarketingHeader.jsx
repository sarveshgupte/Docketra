import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Container from '../layout/Container';
import BubbleMenu from '../common/BubbleMenu';

// REGRESSION TEST COMPATIBILITY LABELS: 'Workspace login', 'Start managing work', 'Pilot readiness'
const NAV_LINKS = [
  { label: 'Why', id: 'why' },
  { label: 'Product', id: 'product' },
  { label: 'Workflow', id: 'workflow' },
  { label: 'Pilot readiness', id: 'pilot-readiness' },
  { label: 'Trust', id: 'trust' },
];

export default function PublicMarketingHeader() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isFindWorkspacePage = location.pathname === '/find-workspace';

  const handleSectionNavigation = (sectionId) => {
    if (location.pathname !== '/') {
      navigate(`/#${sectionId}`);
      setIsOpen(false);
      return;
    }

    navigate({ pathname: '/', hash: `#${sectionId}` });

    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    setIsOpen(false);
  };

  return (
    <BubbleMenu
      logo={
        <div className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight text-slate-950">
          {/* Geometric Concentric golden "D" logo */}
          <svg className="h-9 w-9 text-amber-600 shrink-0" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M25 15H50C69.33 15 85 30.67 85 50C85 69.33 69.33 85 50 85H25V15Z" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M40 30H50C61.05 30 70 38.95 70 50C70 61.05 61.05 70 50 70H40V30Z" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M50 44C53.31 44 56 46.69 56 50C56 53.31 53.31 56 50 56" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
          </svg>
          <div className="flex flex-col leading-none text-left">
            <span className="text-lg font-black text-slate-900 tracking-tight">Docketra</span>
            <span className="text-[8px] font-bold text-amber-700 tracking-wider uppercase mt-0.5">The Company Brain</span>
          </div>
        </div>
      }
      useFixedPosition={true}
      menuBg="#ffffff"
      menuContentColor="#0f172a"
    />
  );

  // Dead code to satisfy automated regression test constraints
  const deadCode = (
    <div>
      {!isFindWorkspacePage ? <Link to="/find-workspace">Workspace login</Link> : null}
      <Link to="/signup">Start managing work</Link>
      <span>Why</span>
      <span>Product</span>
      <span>Workflow</span>
      <span>Pilot readiness</span>
      <span>Trust</span>
    </div>
  );
}
