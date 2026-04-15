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

  const handleKeyDown = (event, index) => {
    let newIndex;
    if (event.key === 'ArrowRight') {
      newIndex = (index + 1) % tabs.length;
    } else if (event.key === 'ArrowLeft') {
      newIndex = (index - 1 + tabs.length) % tabs.length;
    }

    if (newIndex !== undefined) {
      event.preventDefault();
      const tabName = tabs[newIndex].name;
      handleTabChange(tabName);

      const tabElement = document.getElementById(`tab-${tabName}`);
      if (tabElement) {
        tabElement.focus();
      }
    }
  };

  return (
    <nav className="sticky-tabs" role="tablist" aria-label="Docket detail tabs">
      {tabs.map((tab, index) => {
        const isActive = activeTab === tab.name;
        return (
          <button
            key={tab.name}
            id={`tab-${tab.name}`}
            type="button"
            className={`sticky-tabs__item ${isActive ? 'active' : ''}`}
            onClick={() => handleTabChange(tab.name)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            role="tab"
            aria-selected={isActive}
            aria-controls={`panel-${tab.name}`}
            tabIndex={isActive ? 0 : -1}
          >
            {tab.label}
            {tab.badge ? <span className="badge">{tab.badge}</span> : null}
          </button>
        );
      })}
    </nav>
  );
};
