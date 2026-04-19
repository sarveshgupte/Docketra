import React, { useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCount } from '../common/BadgeCount';

export const SidebarSection = ({
  title,
  items,
  sticky = false,
  defaultOpen = true,
  collapsible = true,
  collapsed = false,
  expandedGroupId = null,
  onGroupToggle = null,
  onNavigate = null,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const canToggle = collapsible && !sticky;
  const sectionId = useId();
  const visibleItems = useMemo(() => items.filter((item) => !item.hidden), [items]);

  const handleGroupToggle = (groupId) => {
    if (!onGroupToggle) return;
    onGroupToggle(groupId);
  };

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
          <span className={`enterprise-sidebar__section-chevron text-gray-400 ${isOpen ? 'is-open' : ''}`} aria-hidden="true">›</span>
        ) : null}
      </button>

      {isOpen && (
        <div className="enterprise-sidebar__section-items">
          {visibleItems.map((item) => {
            if (item.type === 'group') {
              const isGroupOpen = expandedGroupId === item.id;
              const groupContentId = `${sectionId}-${item.id}`;
              const children = (item.children || []).filter((child) => !child.hidden);

              return (
                <div key={item.id} className="enterprise-sidebar__group">
                  <button
                    type="button"
                    className={[
                      'enterprise-sidebar__nav-link enterprise-sidebar__group-trigger text-sm font-medium',
                      item.active ? 'active bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900',
                      collapsed ? 'enterprise-sidebar__nav-link--collapsed' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => handleGroupToggle(item.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleGroupToggle(item.id);
                      }
                    }}
                    aria-expanded={isGroupOpen}
                    aria-controls={groupContentId}
                    aria-label={collapsed ? item.label : undefined}
                    data-tooltip={collapsed ? item.label : undefined}
                    title={collapsed ? item.label : undefined}
                  >
                    <span className={`enterprise-sidebar__nav-icon ${item.active ? 'text-blue-700' : 'text-gray-500'}`} aria-hidden="true">{item.icon}</span>
                    {!collapsed ? <span className={`enterprise-sidebar__nav-text ${item.active ? 'text-blue-700' : 'text-gray-700'}`}>{item.label}</span> : null}
                    {!collapsed ? (
                      <span className={`enterprise-sidebar__group-chevron ${isGroupOpen ? 'is-open' : ''}`} aria-hidden="true">▾</span>
                    ) : null}
                  </button>
                  {!collapsed && isGroupOpen ? (
                    <div id={groupContentId} className="enterprise-sidebar__group-items">
                      {children.map((child) => (
                        <Link
                          key={child.id || child.to}
                          to={child.to}
                          className={[
                            'enterprise-sidebar__nav-link enterprise-sidebar__nav-link--child text-sm font-medium',
                            child.active ? 'active bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900',
                          ].filter(Boolean).join(' ')}
                          aria-current={child.active ? 'page' : undefined}
                          onClick={onNavigate}
                        >
                          <span className={`enterprise-sidebar__nav-icon ${child.active ? 'text-blue-700' : 'text-gray-500'}`} aria-hidden="true">{child.icon}</span>
                          <span className={`enterprise-sidebar__nav-text ${child.active ? 'text-blue-700' : 'text-gray-700'}`}>{child.label}</span>
                          <BadgeCount count={child.badge} />
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            }

            return (
              <Link
                key={item.id || item.to}
                to={item.to}
                className={[
                  'enterprise-sidebar__nav-link text-sm font-medium',
                  item.active ? 'active bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900',
                  collapsed ? 'enterprise-sidebar__nav-link--collapsed' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-current={item.active ? 'page' : undefined}
                aria-label={collapsed ? item.label : undefined}
                data-tooltip={collapsed ? item.label : undefined}
                title={collapsed ? item.label : undefined}
                onClick={onNavigate}
              >
                <span className={`enterprise-sidebar__nav-icon ${item.active ? 'text-blue-700' : 'text-gray-500'}`} aria-hidden="true">{item.icon}</span>
                {!collapsed ? <span className={`enterprise-sidebar__nav-text ${item.active ? 'text-blue-700' : 'text-gray-700'}`}>{item.label}</span> : null}
                {!collapsed ? <BadgeCount count={item.badge} /> : null}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};
