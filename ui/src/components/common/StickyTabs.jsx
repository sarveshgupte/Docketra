import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { VALID_CASE_DETAIL_TAB_NAMES } from '../../utils/constants';

export const StickyTabs = ({ tabs = [], defaultTab = 'overview', onTabChange }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const queryTab = params.get('tab');
  const activeTab = VALID_CASE_DETAIL_TAB_NAMES.includes(queryTab) ? queryTab : defaultTab;

  useEffect(() => {
    if (queryTab && !VALID_CASE_DETAIL_TAB_NAMES.includes(queryTab)) {
      const next = new URLSearchParams(location.search);
      next.set('tab', defaultTab);
      navigate(`${location.pathname}?${next.toString()}`, { replace: true });
    }
  }, [queryTab, location.pathname, location.search, navigate, defaultTab]);

  const handleTabChange = (tabName) => {
    const next = new URLSearchParams(location.search);
    next.set('tab', tabName);
    navigate(`${location.pathname}?${next.toString()}`, { replace: true });
    onTabChange?.(tabName);
  };

  return (
    <nav className="sticky-tabs" role="tablist" aria-label="Case detail tabs">
      {tabs.map((tab) => (
        <button
          key={tab.name}
          type="button"
          className={`sticky-tabs__item ${activeTab === tab.name ? 'active' : ''}`}
          onClick={() => handleTabChange(tab.name)}
          role="tab"
          aria-selected={activeTab === tab.name}
        >
          {tab.label}
          {tab.badge ? <span className="badge">{tab.badge}</span> : null}
        </button>
      ))}
    </nav>
  );
};
