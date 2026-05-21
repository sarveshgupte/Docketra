import { ROUTES } from './routes.js';
import { canManageClients } from '../utils/permissions.js';

const roleRank = { USER: 1, MANAGER: 2, ADMIN: 3, PRIMARY_ADMIN: 4 };
const hasAtLeastRole = (current, minimum) => (roleRank[current] || 0) >= (roleRank[minimum] || 0);
const resolveId = (wb) => String(wb?._id || wb?.id || wb?.workbasketId || '').trim();
const buildWorklistRoute = (firmSlug, id) => `${ROUTES.WORKLIST(firmSlug)}?workbasketId=${encodeURIComponent(id)}`;

/* SVG icon definitions — inline so no additional deps needed */
const icons = { work:'', dashboard:'', intake:'', relationships:'', brain:'', library:'', clients:'', reports:'', team:'', settings:'' };

const NAV_BLUEPRINT = [
  { section: 'Daily Operations', items: [{ id:'dashboard', label:'Dashboard', route:(firmSlug)=>ROUTES.DASHBOARD(firmSlug)}] },
  { section: 'Client Workspace', items:[{ id:'clients', label:'Clients', minRole:'ADMIN', route:(firmSlug)=>ROUTES.CLIENTS(firmSlug)}]},
  { section: 'Oversight', items:[{ id:'reports', label:'Reports', minRole:'ADMIN', route:(firmSlug)=>ROUTES.ADMIN_REPORTS(firmSlug), activeMatch:'exactOrDescendant'}]},
  { section: 'Administration', items:[{ id:'team-access', label:'Team & Access', minRole:'ADMIN', route:(firmSlug)=>ROUTES.ADMIN(firmSlug), activeMatch:'exactOrDescendant', excludeActiveFor:(firmSlug)=>[ROUTES.ADMIN_REPORTS(firmSlug)] },{ id:'settings', label:'Settings', minRole:'ADMIN', route:(firmSlug)=>ROUTES.SETTINGS(firmSlug), activeMatch:'exactOrDescendant'}]},
];

const toResolvedNavItem = (item, firmSlug) => ({ id:item.id, label:item.label, icon:item.icon||'•', to:item.route(firmSlug), activeMatch:item.activeMatch, excludeActiveFor:typeof item.excludeActiveFor==='function'?item.excludeActiveFor(firmSlug):item.excludeActiveFor });
const resolveAccessContext = (roleOrUser = 'USER', permissions = []) => (roleOrUser && typeof roleOrUser === 'object' && !Array.isArray(roleOrUser) ? roleOrUser : { role: roleOrUser, permissions });

export const getPlatformNavigation = (firmSlug, roleOrUser='USER', permissions=[]) => {
  const accessContext = resolveAccessContext(roleOrUser, permissions);
  const normalizedRole = String(accessContext?.role || 'USER').toUpperCase();
  const assignedWorkbaskets = (Array.isArray(accessContext?.workbaskets) ? accessContext.workbaskets : []).filter((wb) => resolveId(wb));
  const assignedQcWorkbaskets = (Array.isArray(accessContext?.qcWorkbaskets) ? accessContext.qcWorkbaskets : []).filter((wb) => resolveId(wb));
  const canViewGlobalWorkbaskets = hasAtLeastRole(normalizedRole, 'MANAGER');
  const showQcWorkbaskets = hasAtLeastRole(normalizedRole, 'MANAGER') || assignedQcWorkbaskets.length > 0;

  const groupedDailyItems = [];
  if (assignedWorkbaskets.length > 0 || canViewGlobalWorkbaskets) {
    groupedDailyItems.push({
      id: 'daily-workbaskets', label: 'Workbaskets', type: 'group', children: [
        ...(canViewGlobalWorkbaskets ? [{ id:'workbaskets-overview', label:'Overview', to:ROUTES.GLOBAL_WORKLIST(firmSlug), activeMatch:'exactOrDescendant' }] : []),
        ...assignedWorkbaskets.map((wb)=>({ id:`workbasket-${resolveId(wb)}`, label: wb?.name || 'Workbasket', to: ROUTES.WORKBASKET_DETAIL(firmSlug, resolveId(wb)), activeMatch:'exactOrDescendant' })),
      ],
    });
  }
  if (assignedWorkbaskets.length > 0) {
    groupedDailyItems.push({ id:'daily-worklists', label:'Worklists', type:'group', children: assignedWorkbaskets.map((wb)=>({ id:`worklist-${resolveId(wb)}`, label:wb?.name||'Worklist', to: buildWorklistRoute(firmSlug, resolveId(wb)), activeMatch:'exact', activeQuery:{ workbasketId: resolveId(wb) } })) });
  }
  if (showQcWorkbaskets && assignedQcWorkbaskets.length > 0) {
    groupedDailyItems.push({ id:'daily-qc-worklists', label:'QC Worklists', type:'group', children: assignedQcWorkbaskets.map((wb)=>({ id:`qc-workbasket-${resolveId(wb)}`, label:wb?.name||'QC Worklist', to: ROUTES.QC_WORKBASKET_DETAIL(firmSlug, resolveId(wb)), activeMatch:'exactOrDescendant' })) });
  }

  return NAV_BLUEPRINT.map((section)=>({ section:section.section, items: section.items.filter((item)=> item.id==='clients'?canManageClients(accessContext):(!item.minRole||hasAtLeastRole(normalizedRole,item.minRole))).map((item)=>toResolvedNavItem(item, firmSlug)) }))
    .map((section)=>section.section==='Daily Operations'?{...section, items:groupedDailyItems}:section)
    .filter((section)=>section.items.length>0);
};

export const getPlatformDestinationCommands = (firmSlug, roleOrUser='USER', permissions=[]) => {
  const accessContext = resolveAccessContext(roleOrUser, permissions);
  const normalizedRole = String(accessContext?.role || 'USER').toUpperCase();
  return NAV_BLUEPRINT.flatMap((section)=>section.items).filter((item)=>item.id==='clients'?canManageClients(accessContext):(!item.minRole||hasAtLeastRole(normalizedRole,item.minRole))).map((item)=>({ id:`go-${item.id}`, label:`Go to ${item.label}`, to:item.route(firmSlug) }));
};

export const getFirstAssignedWorklistRoute = (firmSlug, accessContext = {}) => {
  const workbaskets = Array.isArray(accessContext?.workbaskets) ? accessContext.workbaskets : [];
  const first = workbaskets.find((wb) => resolveId(wb));
  return first ? buildWorklistRoute(firmSlug, resolveId(first)) : '';
};

export const getFirstAssignedQcWorklistRoute = (firmSlug, accessContext = {}) => {
  const wb = (Array.isArray(accessContext?.qcWorkbaskets) ? accessContext.qcWorkbaskets : []).find((item) => resolveId(item));
  return wb ? ROUTES.QC_WORKBASKET_DETAIL(firmSlug, resolveId(wb)) : '';
};

export const PLATFORM_SHORTCUT_ROUTES = { n:(firmSlug)=>ROUTES.CREATE_CASE(firmSlug), d:(firmSlug)=>ROUTES.DASHBOARD(firmSlug), t:(firmSlug)=>ROUTES.TASK_MANAGER(firmSlug), w:(firmSlug)=>ROUTES.WORKLIST(firmSlug), b:(firmSlug)=>ROUTES.GLOBAL_WORKLIST(firmSlug), q:(firmSlug)=>ROUTES.QC_QUEUE(firmSlug) };
