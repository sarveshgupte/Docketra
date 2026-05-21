import { ROUTES } from './routes.js';
import { canManageClients } from '../utils/permissions.js';

const roleRank = { USER: 1, MANAGER: 2, ADMIN: 3, PRIMARY_ADMIN: 4 };

const hasAtLeastRole = (current, minimum) => (roleRank[current] || 0) >= (roleRank[minimum] || 0);

/* SVG icon definitions — inline so no additional deps needed */
const icons = {
  work: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7a2 2 0 012-2h4l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2z"/></svg>`,
  dashboard: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
  intake: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  relationships: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="3"/><circle cx="5" cy="19" r="3"/><circle cx="19" cy="19" r="3"/><line x1="12" y1="8" x2="5" y2="16"/><line x1="12" y1="8" x2="19" y2="16"/></svg>`,
  brain: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2a2.5 2.5 0 015 0"/><path d="M9.5 22a2.5 2.5 0 010-5h5a2.5 2.5 0 010 5"/><path d="M4 10a5 5 0 015-5"/><path d="M20 10a5 5 0 00-5-5"/><path d="M4 10a5 5 0 000 5"/><path d="M20 10a5 5 0 010 5"/><path d="M9 17v-7"/><path d="M15 17v-7"/></svg>`,
  library: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>`,
  clients: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>`,
  reports: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  team: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  settings: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>`,
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
  const normalizedRole = String(accessContext?.role || 'USER').toUpperCase();
  const assignedWorkbaskets = Array.isArray(accessContext?.workbaskets) ? accessContext.workbaskets : [];
  const assignedQcWorkbaskets = Array.isArray(accessContext?.qcWorkbaskets) ? accessContext.qcWorkbaskets : [];
  const showQcWorkbaskets = hasAtLeastRole(normalizedRole, 'MANAGER') || assignedQcWorkbaskets.length > 0;
  const canViewGlobalWorkbaskets = hasAtLeastRole(normalizedRole, 'MANAGER');
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
    ...(canViewGlobalWorkbaskets ? [{ id: 'workbaskets-overview', label: 'Overview', icon: icons.work, to: ROUTES.GLOBAL_WORKLIST(firmSlug), activeMatch: 'exactOrDescendant' }] : []),
    ...directWorkbasketItems,
  ];
  const qcGroupChildren = [
    ...(canViewGlobalWorkbaskets ? [{ id: 'qc-worklist', label: 'Overview', icon: icons.intake, to: ROUTES.QC_QUEUE(firmSlug), activeMatch: 'exactOrDescendant' }] : []),
    ...directQcWorkbasketItems,
  ];

  const dailyOperationsItems = [
    { id: 'workbaskets-group', label: 'Workbaskets', type: 'group', children: workbasketsGroupChildren },
    { id: 'worklists-group', label: 'Worklists', type: 'group', children: scopedWorklistItems.length ? scopedWorklistItems : [{ id: 'my-worklist', label: 'My Worklist', icon: icons.dashboard, to: ROUTES.WORKLIST(firmSlug), activeMatch: 'exactOrDescendant' }] },
    ...(qcGroupChildren.length ? [{ id: 'qc-worklists-group', label: 'QC Worklists', type: 'group', children: qcGroupChildren }] : []),
  ].filter((item) => Array.isArray(item.children) && item.children.length > 0);

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
    .map((section) => (
      section.section === 'Daily Operations'
        ? { ...section, items: dailyOperationsItems }
        : section
    ))
    .filter((section) => section.items.length > 0)
  );
};

export const getPlatformDestinationCommands = (firmSlug, roleOrUser = 'USER', permissions = []) => {
  const accessContext = resolveAccessContext(roleOrUser, permissions);
  const normalizedRole = String(accessContext?.role || 'USER').toUpperCase();
  return (
  NAV_BLUEPRINT
    .flatMap((section) => section.items)
    .filter((item) => item.command)
    .filter((item) => {
      if (item.id === 'clients') return canManageClients(accessContext);
      return !item.minRole || hasAtLeastRole(normalizedRole, item.minRole);
    })
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
