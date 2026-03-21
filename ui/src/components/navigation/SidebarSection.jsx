import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCount } from '../common/BadgeCount';

export const SidebarSection = ({
  title,
  items,
  sticky = false,
  defaultOpen = true,
  collapsible = true,
  collapsed = false,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const canToggle = collapsible && !sticky;

  return (
    <div className={`enterprise-sidebar__section ${sticky ? 'enterprise-sidebar__section--sticky' : ''}`}>
      <button
        type="button"
        className="enterprise-sidebar__section-header"
        onClick={() => canToggle && setIsOpen((value) => !value)}
        aria-expanded={isOpen}
        disabled={!canToggle || collapsed}
      >
        <span className="enterprise-sidebar__section-title">{title}</span>
        {!collapsed && canToggle ? (
          <span className={`enterprise-sidebar__section-chevron ${isOpen ? 'is-open' : ''}`}>›</span>
        ) : null}
      </button>

      {isOpen && (
        <div className="enterprise-sidebar__section-items">
          {items.filter((item) => !item.hidden).map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`enterprise-sidebar__nav-link ${item.active ? 'active' : ''}`}
              aria-current={item.active ? 'page' : undefined}
              title={collapsed ? item.label : undefined}
            >
              <span className="enterprise-sidebar__nav-icon" aria-hidden="true">{item.icon}</span>
              <span className="enterprise-sidebar__nav-text">{item.label}</span>
              <BadgeCount count={item.badge} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};
