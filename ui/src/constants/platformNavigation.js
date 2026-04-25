import { ROUTES } from './routes';

const roleRank = { USER: 1, MANAGER: 2, ADMIN: 3, PRIMARY_ADMIN: 4 };

const hasAtLeastRole = (current, minimum) => (roleRank[current] || 0) >= (roleRank[minimum] || 0);

const NAV_BLUEPRINT = [
  {
    section: 'Daily Operations',
    items: [
      {
        id: 'docket-workbench',
        label: 'Docket Workbench',
        route: (firmSlug) => ROUTES.TASK_MANAGER(firmSlug),
        command: {
          id: 'go-docket-workbench',
          label: 'Go to Docket Workbench',
          description: 'Jump to the main docket execution workspace.',
          shortcut: 'Alt+Shift+T',
        },
      },
      {
        id: 'dashboard',
        label: 'Dashboard',
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
    section: 'Business Modules',
    items: [
      {
        id: 'intake',
        label: 'Intake (CMS)',
        route: (firmSlug) => ROUTES.CMS(firmSlug),
        minRole: 'ADMIN',
        command: {
          id: 'go-cms',
          label: 'Go to CMS',
          description: 'Open intake and submissions module.',
        },
      },
      {
        id: 'crm',
        label: 'Pipeline (CRM)',
        route: (firmSlug) => ROUTES.CRM(firmSlug),
        minRole: 'ADMIN',
        command: {
          id: 'go-crm',
          label: 'Go to CRM',
          description: 'Open relationship management module.',
        },
      },
      {
        id: 'clients',
        label: 'Clients',
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
        id: 'team-access',
        label: 'Team & Access',
        route: (firmSlug) => ROUTES.ADMIN(firmSlug),
        minRole: 'ADMIN',
        activeMatch: 'exactOrDescendant',
        excludeActiveFor: (firmSlug) => [ROUTES.ADMIN_REPORTS(firmSlug)],
        command: {
          id: 'go-team',
          label: 'Go to Team',
          description: 'Open team management.',
        },
      },
      {
        id: 'settings',
        label: 'Settings',
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
  to: item.route(firmSlug),
  activeMatch: item.activeMatch,
  excludeActiveFor: typeof item.excludeActiveFor === 'function' ? item.excludeActiveFor(firmSlug) : item.excludeActiveFor,
});

export const getPlatformNavigation = (firmSlug, role = 'USER') => (
  NAV_BLUEPRINT
    .map((section) => ({
      section: section.section,
      items: section.items
        .filter((item) => !item.minRole || hasAtLeastRole(role, item.minRole))
        .map((item) => toResolvedNavItem(item, firmSlug)),
    }))
    .filter((section) => section.items.length > 0)
);

export const getPlatformDestinationCommands = (firmSlug, role = 'USER') => (
  NAV_BLUEPRINT
    .flatMap((section) => section.items)
    .filter((item) => item.command)
    .filter((item) => !item.minRole || hasAtLeastRole(role, item.minRole))
    .map((item) => ({
      id: item.command.id,
      label: item.command.label,
      description: item.command.description,
      shortcut: item.command.shortcut,
      to: item.route(firmSlug),
    }))
);

export const PLATFORM_SHORTCUT_ROUTES = {
  n: (firmSlug) => ROUTES.CREATE_CASE(firmSlug),
  d: (firmSlug) => ROUTES.DASHBOARD(firmSlug),
  t: (firmSlug) => ROUTES.TASK_MANAGER(firmSlug),
  w: (firmSlug) => ROUTES.WORKLIST(firmSlug),
  b: (firmSlug) => ROUTES.GLOBAL_WORKLIST(firmSlug),
  q: (firmSlug) => ROUTES.QC_QUEUE(firmSlug),
};
