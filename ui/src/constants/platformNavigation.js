import React from 'react';
import { ROUTES } from './routes.js';
import { canManageClients } from '../utils/permissions.js';
import { FIRM_PILOT_SURFACE, TASK_MANAGER_MVP_ENABLED } from './pilotSurface.js';

const roleRank = { USER: 1, MANAGER: 2, ADMIN: 3, PRIMARY_ADMIN: 4 };

const hasAtLeastRole = (current, minimum) => (roleRank[current] || 0) >= (roleRank[minimum] || 0);

const createIcon = (...children) => React.createElement(
  'svg',
  { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' },
  ...children,
);

const icons = {
  work: createIcon(React.createElement('path', { d: 'M4 7a2 2 0 012-2h4l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2z' })),
  dashboard: createIcon(React.createElement('rect', { x: 3, y: 3, width: 7, height: 7 }), React.createElement('rect', { x: 14, y: 3, width: 7, height: 7 }), React.createElement('rect', { x: 14, y: 14, width: 7, height: 7 }), React.createElement('rect', { x: 3, y: 14, width: 7, height: 7 })),
  intake: createIcon(React.createElement('path', { d: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4' }), React.createElement('polyline', { points: '7 10 12 15 17 10' }), React.createElement('line', { x1: 12, y1: 15, x2: 12, y2: 3 })),
  clients: createIcon(React.createElement('path', { d: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2' }), React.createElement('circle', { cx: 9, cy: 7, r: 4 }), React.createElement('path', { d: 'M23 21v-2a4 4 0 00-3-3.87' }), React.createElement('path', { d: 'M16 3.13a4 4 0 010 7.75' })),
  reports: createIcon(React.createElement('line', { x1: 18, y1: 20, x2: 18, y2: 10 }), React.createElement('line', { x1: 12, y1: 20, x2: 12, y2: 4 }), React.createElement('line', { x1: 6, y1: 20, x2: 6, y2: 14 })),
  settings: createIcon(React.createElement('circle', { cx: 12, cy: 12, r: 3 }), React.createElement('path', { d: 'M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z' })),
  compliance: createIcon(
    React.createElement('rect', { x: 3, y: 4, width: 18, height: 16, rx: 2 }),
    React.createElement('line', { x1: 8, y1: 2, x2: 8, y2: 6 }),
    React.createElement('line', { x1: 16, y1: 2, x2: 16, y2: 6 }),
    React.createElement('line', { x1: 3, y1: 10, x2: 21, y2: 10 }),
  ),
  intelligence: createIcon(
    React.createElement('path', { d: 'M9.5 3a3 3 0 00-3 3v1.5A3.5 3.5 0 003 11v1a3.5 3.5 0 003.5 3.5V17a3 3 0 006 0V6a3 3 0 00-3-3z' }),
    React.createElement('path', { d: 'M14.5 3a3 3 0 013 3v1.5A3.5 3.5 0 0121 11v1a3.5 3.5 0 01-3.5 3.5V17a3 3 0 01-6 0V6a3 3 0 013-3z' }),
    React.createElement('path', { d: 'M8 9h2M14 9h2M8.5 14H10M14 14h1.5' }),
  ),
};

const NAV_BLUEPRINT = [
  {
    section: 'Daily Operations',
    items: [
      {
        id: 'docket-workbench',
        label: 'Work',
        icon: icons.work,
        route: (firmSlug) => ROUTES.TASK_MANAGER(firmSlug),
        command: {
          id: 'go-docket-workbench',
          label: 'Go to Work',
          description: 'Open daily work execution queues and workspace context.',
          shortcut: 'Alt+Shift+T',
        },
      },
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: icons.dashboard,
        route: (firmSlug) => ROUTES.DASHBOARD(firmSlug),
        command: {
          id: 'go-dashboard',
          label: 'Go to Dashboard',
          description: 'Open firm dashboard overview.',
          shortcut: 'Alt+Shift+D',
        },
      },
    ],
  },
    {
    section: 'Client Workspace',
    items: [
      {
        id: 'clients',
        label: 'Clients',
        icon: icons.clients,
        route: (firmSlug) => ROUTES.CLIENTS(firmSlug),
        minRole: 'ADMIN',
        command: {
          id: 'go-clients',
          label: 'Go to Clients',
          description: 'Open client management workspace.',
        },
      },
    ],
  },
  {
    section: 'Oversight',
    items: [
      {
        id: 'reports',
        label: 'Reports',
        icon: icons.reports,
        route: (firmSlug) => ROUTES.ADMIN_REPORTS(firmSlug),
        minRole: 'ADMIN',
        activeMatch: 'exactOrDescendant',
        command: {
          id: 'go-reports',
          label: 'Go to Reports',
          description: 'Open operational reports.',
        },
      },
    ],
  },
  {
    section: 'Administration',
    items: [
      {
        id: 'settings',
        label: 'Settings',
        icon: icons.settings,
        route: (firmSlug) => ROUTES.SETTINGS(firmSlug),
        minRole: 'ADMIN',
        activeMatch: 'exactOrDescendant',
        command: {
          id: 'go-settings',
          label: 'Go to Settings',
          description: 'Open workspace settings.',
        },
      },
      {
        id: 'team-management',
        label: 'Users & Team',
        icon: icons.clients,
        route: (firmSlug) => ROUTES.ADMIN(firmSlug),
        minRole: 'ADMIN',
        activeMatch: 'exactOrDescendant',
        excludeActiveFor: (firmSlug) => [ROUTES.WORK_CATEGORY_MANAGEMENT(firmSlug)],
      },
      {
        id: 'workbasket-settings',
        label: 'Workbasket Settings',
        icon: icons.work,
        route: (firmSlug) => ROUTES.WORK_SETTINGS(firmSlug),
        minRole: 'ADMIN',
        activeMatch: 'exactOrDescendant',
      },
      {
        id: 'category-settings',
        label: 'Category Settings',
        icon: icons.intake,
        route: (firmSlug) => ROUTES.WORK_CATEGORY_MANAGEMENT(firmSlug),
        minRole: 'ADMIN',
        activeMatch: 'exactWithQuery',
      },
      {
        id: 'storage-settings',
        label: 'Storage Configuration',
        icon: icons.settings,
        route: (firmSlug) => ROUTES.STORAGE_SETTINGS(firmSlug),
        minRole: 'ADMIN',
        activeMatch: 'exactOrDescendant',
      },
      {
        id: 'data-storage-map',
        label: 'Storage Boundary Map',
        icon: icons.reports,
        route: (firmSlug) => ROUTES.DATA_STORAGE_MAP(firmSlug),
        minRole: 'ADMIN',
        activeMatch: 'exactOrDescendant',
      },
    ],
  },
];

const toResolvedNavItem = (item, firmSlug) => ({
  id: item.id,
  label: item.label,
  icon: item.icon || '•',
  to: item.route(firmSlug),
  activeMatch: item.activeMatch,
  excludeActiveFor: typeof item.excludeActiveFor === 'function' ? item.excludeActiveFor(firmSlug) : item.excludeActiveFor,
});

const resolveAccessContext = (roleOrUser = 'USER', permissions = []) => {
  if (roleOrUser && typeof roleOrUser === 'object' && !Array.isArray(roleOrUser)) {
    return roleOrUser;
  }
  return { role: roleOrUser, permissions };
};

export const getPlatformNavigation = (firmSlug, roleOrUser = 'USER', permissions = []) => {
  const accessContext = resolveAccessContext(roleOrUser, permissions);
  const normalizedRole = String(accessContext?.role || 'USER').trim().toUpperCase().replace(/[\s-]+/g, '_');
  const assignedWorkbaskets = Array.isArray(accessContext?.workbaskets) ? accessContext.workbaskets : [];
  const assignedQcWorkbaskets = Array.isArray(accessContext?.qcWorkbaskets) ? accessContext.qcWorkbaskets : [];
  const showQcWorkbaskets = hasAtLeastRole(normalizedRole, 'MANAGER') || assignedQcWorkbaskets.length > 0;
  const directWorkbasketItems = assignedWorkbaskets.map((wb) => ({
    id: `workbasket-${String(wb?._id || wb?.id || wb?.workbasketId || '').trim()}`,
    label: wb?.name || 'Workbasket',
    icon: icons.work,
    to: ROUTES.WORKBASKET_DETAIL(firmSlug, String(wb?._id || wb?.id || wb?.workbasketId || '').trim()),
    activeMatch: 'exactOrDescendant',
  })).filter((item) => !item.to.endsWith('/workbaskets/'));
  const directQcWorkbasketItems = showQcWorkbaskets
    ? assignedQcWorkbaskets.map((wb) => ({
      id: `qc-workbasket-${String(wb?._id || wb?.id || wb?.workbasketId || '').trim()}`,
      label: wb?.name || 'Workbasket',
      icon: icons.intake,
      to: ROUTES.QC_WORKBASKET_DETAIL(firmSlug, String(wb?._id || wb?.id || wb?.workbasketId || '').trim()),
      activeMatch: 'exactOrDescendant',
    })).filter((item) => !item.to.endsWith('/qc-workbaskets/'))
    : [];

  const scopedWorklistItems = assignedWorkbaskets
    .map((wb) => {
      const id = String(wb?._id || wb?.id || wb?.workbasketId || '').trim();
      if (!id) return null;
      return {
        id: `worklist-${id}`,
        label: wb?.name || 'Workbasket',
        icon: icons.dashboard,
        to: `${ROUTES.WORKLIST(firmSlug)}?workbasketId=${encodeURIComponent(id)}`,
        activeMatch: 'exactWithQuery',
      };
    })
    .filter(Boolean);

  const workbasketsGroupChildren = [
    ...directWorkbasketItems,
  ];
  const qcGroupChildren = [
    ...directQcWorkbasketItems,
  ];

  const dailyOperationsItems = [
    {
      id: 'compliance-control-room',
      label: 'Compliance Control',
      icon: icons.compliance,
      to: ROUTES.COMPLIANCE_CALENDAR(firmSlug),
      activeMatch: 'exactOrDescendant',
    },
    { id: 'workbaskets-group', label: 'Workbaskets', type: 'group', children: workbasketsGroupChildren },
    ...(hasAtLeastRole(normalizedRole, 'MANAGER') ? [{
      id: 'docketra-intelligence',
      label: 'Docketra Intelligence',
      icon: icons.intelligence,
      to: ROUTES.DOCKETRA_INTELLIGENCE(firmSlug),
      activeMatch: 'exactOrDescendant',
    }] : []),
    { id: 'worklists-group', label: 'Worklists', type: 'group', children: scopedWorklistItems.length ? scopedWorklistItems : [{ id: 'my-worklist', label: 'My Worklist', icon: icons.dashboard, to: ROUTES.WORKLIST(firmSlug), activeMatch: 'exactOrDescendant' }] },
    ...(qcGroupChildren.length ? [{ id: 'qc-worklists-group', label: 'QC Worklists', type: 'group', children: qcGroupChildren }] : []),
  ].filter((item) => item.id === 'compliance-control-room' || item.id === 'docketra-intelligence' || (Array.isArray(item.children) && item.children.length > 0));

  const isNavHidden = (id) => TASK_MANAGER_MVP_ENABLED && FIRM_PILOT_SURFACE.hideFromNavigation.has(id);
  const administrationItems = (!isNavHidden('settings') && hasAtLeastRole(normalizedRole, 'MANAGER'))
    ? [{ id: 'settings', label: 'Settings', icon: icons.settings, to: ROUTES.SETTINGS(firmSlug), activeMatch: 'exactOrDescendant' }]
    : [];

  return (
  NAV_BLUEPRINT
    .map((section) => ({
      section: section.section,
      items: section.items
        .filter((item) => {
          if (item.id === 'clients') return canManageClients(accessContext);
          return !item.minRole || hasAtLeastRole(normalizedRole, item.minRole);
        })
        .map((item) => toResolvedNavItem(item, firmSlug)),
    }))
    .map((section) => {
      if (section.section === 'Daily Operations') {
        return { ...section, items: dailyOperationsItems };
      }
      if (section.section === 'Administration') {
        return { ...section, items: administrationItems };
      }
      return section;
    })
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !TASK_MANAGER_MVP_ENABLED || !FIRM_PILOT_SURFACE.hideFromNavigation.has(item.id)),
    }))
    .filter((section) => section.items.length > 0)
  );
};

export const getPlatformDestinationCommands = (firmSlug, roleOrUser = 'USER', permissions = []) => {
  const accessContext = resolveAccessContext(roleOrUser, permissions);
  const normalizedRole = String(accessContext?.role || 'USER').trim().toUpperCase().replace(/[\s-]+/g, '_');
  return (
  NAV_BLUEPRINT
    .flatMap((section) => section.items)
    .filter((item) => item.command)
    .filter((item) => {
      if (item.id === 'clients') return canManageClients(accessContext);
      return !item.minRole || hasAtLeastRole(normalizedRole, item.minRole);
    })
    .filter((item) => !TASK_MANAGER_MVP_ENABLED || !FIRM_PILOT_SURFACE.hideFromNavigation.has(item.id))
    .map((item) => ({
      id: item.command.id,
      label: item.command.label,
      description: item.command.description,
      shortcut: item.command.shortcut,
      to: item.route(firmSlug),
    }))
  );
};

export const PLATFORM_SHORTCUT_ROUTES = {
  n: (firmSlug) => ROUTES.CREATE_CASE(firmSlug),
  d: (firmSlug) => ROUTES.DASHBOARD(firmSlug),
  t: (firmSlug) => ROUTES.TASK_MANAGER(firmSlug),
  w: (firmSlug) => ROUTES.WORKLIST(firmSlug),
  b: (firmSlug) => ROUTES.GLOBAL_WORKLIST(firmSlug),
  q: (firmSlug) => ROUTES.QC_QUEUE(firmSlug),
};
