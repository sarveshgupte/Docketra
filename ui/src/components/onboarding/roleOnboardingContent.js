import { ROUTES, safeRoute } from '../../constants/routes';

export const normalizeOnboardingRole = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'SUPER_ADMIN' || normalized === 'SUPERADMIN') return 'super_admin';
  if (normalized === 'PRIMARY_ADMIN') return 'primary_admin';
  if (normalized === 'ADMIN') return 'admin';
  if (normalized === 'MANAGER') return 'manager';
  return 'user';
};

const BASE_INTRO = {
  whatIsDocketra:
    'Docketra is your firm operating system for client work, internal workflows, and compliance execution. It connects clients, dockets, workbaskets, QC handoffs, audit history, and document flows in one place.',
};

export const ROLE_ONBOARDING_CONTENT = {
  super_admin: {
    roleLabel: 'Superadmin',
    roleSummary: 'You oversee platform health, firms, and support controls. You do not run day-to-day dockets for a firm.',
    canDo: [
      'Inspect firm-level setup and activation readiness without changing firm workflow data.',
      'Monitor subscription, usage, and support signals at platform level.',
      'Assist recovery and access issues with minimal intervention.',
    ],
    startHere: [
      'Review platform dashboard health and recent firm activity.',
      'Open Firms Management for tenant verification and support context.',
      'Intervene only when required to unblock a firm or resolve billing/access incidents.',
    ],
    checklist: [
      'Review platform alerts and usage exceptions.',
      'Inspect a firm context safely before making any operational changes.',
      'Confirm support escalation notes are captured for auditability.',
    ],
  },
  primary_admin: {
    roleLabel: 'Primary Admin',
    roleSummary: 'You own firm setup, hierarchy, and operational reliability for everyone using Docketra.',
    canDo: [
      'Configure firm foundation: clients, categories, sub-categories, workbaskets, and team hierarchy.',
      'Enable BYOS and BYOAI controls when your firm requires external storage/AI integrations.',
      'Define docket routing and QC workbasket flow, then monitor compliance calendar and audits.',
    ],
    startHere: [
      'Complete firm setup and defaults in Settings before scaling usage.',
      'Invite admins, managers, and users with clear reporting lines.',
      'Create one production docket and validate handoff from intake to QC to completion.',
    ],
    checklist: [
      'Complete workspace profile and compliance defaults.',
      'Invite your first admin/manager/user.',
      'Add first client and service category tree.',
      'Map sub-categories to workbaskets + QC workbaskets.',
      'Review compliance calendar and audit logs.',
      'Connect BYOS/BYOAI if your policy requires it.',
    ],
  },
  admin: {
    roleLabel: 'Admin',
    roleSummary: 'You run firm operations under the Primary Admin and keep setup + docket flow healthy.',
    canDo: [
      'Manage assigned teams, client records, categories, and docket workflows where permission allows.',
      'Monitor pending work, assignment quality, and process compliance.',
      'Support managers and users by removing operational blockers.',
    ],
    startHere: [
      'Review team assignments and active workbaskets.',
      'Check unassigned/pending dockets and route to correct owners.',
      'Confirm category/workbasket setup is complete before high-volume intake.',
    ],
    checklist: [
      'Validate your team and assignment coverage.',
      'Review pending and overdue dockets.',
      'Fix any missing category/sub-category mapping.',
      'Confirm managers have required queue visibility.',
    ],
  },
  manager: {
    roleLabel: 'Manager',
    roleSummary: 'You manage throughput and quality for assigned workbaskets and operational queues.',
    canDo: [
      'Review team workload and queue flow across assigned workbaskets.',
      'Coordinate docket movement through stages, including QC handoff paths.',
      'Escalate blockers and maintain turnaround discipline.',
    ],
    startHere: [
      'Open your work queues and identify stalled or overdue dockets.',
      'Validate your team coverage on active workbaskets.',
      'Run a daily QC review cadence for items nearing deadline.',
    ],
    checklist: [
      'Review assigned workbaskets + QC queue coverage.',
      'Check pending dockets and blocked items.',
      'Balance workload across team members.',
      'Confirm handoff quality before closure.',
    ],
  },
  user: {
    roleLabel: 'User',
    roleSummary: 'You execute assigned dockets accurately and keep status, documents, and audit history up to date.',
    canDo: [
      'Work from assigned queues, update docket status, and provide clean handoff notes.',
      'Use client/category/sub-category correctly for audit-ready records.',
      'Request documents and upload evidence where your workflow requires it.',
    ],
    startHere: [
      'Open My Worklist and start with overdue or due-soon dockets.',
      'Update status/comment trail whenever progress changes.',
      'Escalate assignment or data gaps early to your manager/admin.',
    ],
    checklist: [
      'Review your assigned workbaskets.',
      'Open and update your first docket.',
      'Follow status flow and handoff notes clearly.',
      'Track due dates and compliance milestones daily.',
    ],
  },
};

export const getRoleOnboardingContent = (role) => {
  const normalizedRole = normalizeOnboardingRole(role);
  return {
    roleKey: normalizedRole,
    ...BASE_INTRO,
    ...(ROLE_ONBOARDING_CONTENT[normalizedRole] || ROLE_ONBOARDING_CONTENT.user),
  };
};

export const buildRoleTourSteps = (role, firmSlug) => {
  const normalizedRole = normalizeOnboardingRole(role);
  const common = [
    {
      id: 'dashboard',
      title: 'Dashboard risk view',
      description: 'Start every day here to prioritize overdue dockets, due dates, and execution risk.',
      selector: '[data-tour-anchor="kpi-strip"]',
      actionLabel: 'Open dashboard',
      route: safeRoute(ROUTES.DASHBOARD(firmSlug)),
    },
    {
      id: 'dockets',
      title: 'Docket registry',
      description: 'Use Dockets to create, search, and review operational records with full status and audit trail.',
      selector: '[data-tour-anchor="recent-dockets"]',
      actionLabel: 'Open dockets',
      route: safeRoute(ROUTES.CASES(firmSlug)),
    },
  ];

  const roleSpecific = {
    primary_admin: [
      { id: 'admin', title: 'Team hierarchy + access', description: 'Set up hierarchy and permissions so admins, managers, and users are routed correctly.', actionLabel: 'Open admin', route: safeRoute(ROUTES.ADMIN(firmSlug)) },
      { id: 'work-settings', title: 'Categories and workbaskets', description: 'Define categories, sub-categories, and workbasket mapping including QC paths.', actionLabel: 'Open work settings', route: safeRoute(ROUTES.WORK_SETTINGS(firmSlug)) },
      { id: 'integrations', title: 'BYOS / BYOAI controls', description: 'Configure storage and AI integration only when your firm policy requires it.', actionLabel: 'Open storage settings', route: safeRoute(ROUTES.STORAGE_SETTINGS(firmSlug)) },
    ],
    admin: [
      { id: 'global-worklist', title: 'Firm work queues', description: 'Use global queues to route intake, clear bottlenecks, and maintain turnaround.', actionLabel: 'Open global worklist', route: safeRoute(ROUTES.GLOBAL_WORKLIST(firmSlug)) },
      { id: 'compliance', title: 'Compliance calendar', description: 'Track near-term deadlines and plan docket execution before risk accumulates.', actionLabel: 'Open compliance calendar', route: safeRoute(ROUTES.COMPLIANCE_CALENDAR(firmSlug)) },
    ],
    manager: [
      { id: 'worklist', title: 'Operational queue control', description: 'Monitor assigned queue volume and rebalance work before SLA slippage.', actionLabel: 'Open worklist', route: safeRoute(ROUTES.WORKLIST(firmSlug)) },
      { id: 'qc', title: 'QC queue monitoring', description: 'Use QC queue to catch quality gaps before final completion.', actionLabel: 'Open QC queue', route: safeRoute(ROUTES.QC_QUEUE(firmSlug)) },
    ],
    user: [
      { id: 'my-worklist', title: 'My assigned work', description: 'My Worklist is your command center for daily execution and status updates.', actionLabel: 'Open My Worklist', route: safeRoute(ROUTES.MY_WORKLIST(firmSlug)) },
      { id: 'compliance', title: 'Compliance timeline', description: 'Use compliance calendar to understand upcoming deadlines impacting your workload.', actionLabel: 'Open compliance calendar', route: safeRoute(ROUTES.COMPLIANCE_CALENDAR(firmSlug)) },
    ],
    super_admin: [
      { id: 'platform', title: 'Platform oversight', description: 'Use platform views for firm-level diagnostics and support, not day-to-day firm operations.', actionLabel: 'Open superadmin dashboard', route: safeRoute(ROUTES.SUPERADMIN_DASHBOARD) },
    ],
  };

  return [...common, ...(roleSpecific[normalizedRole] || roleSpecific.user)];
};
