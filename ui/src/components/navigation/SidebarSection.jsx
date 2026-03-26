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
        className="enterprise-sidebar__section-header text-xs font-semibold uppercase tracking-[0.08em] text-gray-500"
        onClick={() => canToggle && setIsOpen((value) => !value)}
        aria-expanded={isOpen}
        disabled={!canToggle || collapsed}
      >
        <span className="enterprise-sidebar__section-title">{title}</span>
        {!collapsed && canToggle ? (
          <span className={`enterprise-sidebar__section-chevron text-gray-400 ${isOpen ? 'is-open' : ''}`}>›</span>
        ) : null}
      </button>

      {isOpen && (
        <div className="enterprise-sidebar__section-items">
          {items.filter((item) => !item.hidden).map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={[
                'enterprise-sidebar__nav-link text-sm font-medium',
                item.active ? 'active bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50 hover:text-text-primary',
                collapsed ? 'enterprise-sidebar__nav-link--collapsed' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-current={item.active ? 'page' : undefined}
              aria-label={collapsed ? item.label : undefined}
              data-tooltip={collapsed ? item.label : undefined}
              title={collapsed ? item.label : undefined}
            >
              <span className={`enterprise-sidebar__nav-icon ${item.active ? 'text-blue-700' : 'text-gray-500'}`} aria-hidden="true">{item.icon}</span>
              {!collapsed ? <span className={`enterprise-sidebar__nav-text ${item.active ? 'text-blue-700' : 'text-gray-700'}`}>{item.label}</span> : null}
              {!collapsed ? <BadgeCount count={item.badge} /> : null}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};
