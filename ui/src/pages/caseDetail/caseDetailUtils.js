import { normalizeLifecycle } from '../../utils/lifecycle';

const toLegacyCaseShape = (detail = {}, legacy = {}) => ({
  ...legacy,
  caseId: detail.docketId || legacy.caseId,
  title: detail.title || legacy.title,
  description: detail.description || legacy.description,
  lifecycle: detail.lifecycle || legacy.lifecycle,
  status: detail.statusLabel || legacy.status,
  dueDate: detail?.dates?.dueDate || legacy.dueDate,
  slaDueAt: detail?.dates?.slaDueAt || legacy.slaDueAt,
  pendingUntil: detail?.dates?.pendingUntil || legacy.pendingUntil,
  createdAt: detail?.dates?.createdAt || legacy.createdAt,
  updatedAt: detail?.dates?.updatedAt || legacy.updatedAt,
  sop: detail.sop || legacy.sop || null,
  checklist: Array.isArray(detail.checklist) ? detail.checklist : (Array.isArray(legacy.checklist) ? legacy.checklist : []),
  approvalStage: detail.approvalStage || legacy.approvalStage || legacy.approval_stage || null,
  client: detail.client ? {
    ...(legacy.client || {}),
    _id: detail.client.id || legacy?.client?._id,
    clientId: detail.client.clientId || legacy?.client?.clientId,
    businessName: detail.client.name || legacy?.client?.businessName,
    businessEmail: detail.client.email || legacy?.client?.businessEmail,
    primaryContactNumber: detail.client.contact || legacy?.client?.primaryContactNumber,
  } : legacy.client,
  assignedToXID: detail.assignee?.xID || legacy.assignedToXID,
  assignedToName: detail.assignee?.name || legacy.assignedToName,
  workbasketName: detail.workbasket?.name || legacy.workbasketName || legacy.queueName || legacy.ownerTeamName,
});

export const normalizeCase = (data) => {
  const root = data?.case || data || {};
  const detail = root?.docketDetail || data?.docketDetail;
  return detail ? toLegacyCaseShape(detail, root) : root;
};

export const toLifecycleStage = (lifecycle) => {
  return getBusinessLifecycleLabel({ lifecycle });
};

export const normalizeLifecycleForUi = (lifecycle) => normalizeLifecycle(lifecycle);

const normalizeToken = (value) => String(value ?? '').trim().toUpperCase();

const isTruthyToken = (value) => ['TRUE', 'YES', '1', 'RETURNED', 'SUBMITTED'].includes(normalizeToken(value));

export const isDocketRouted = (caseInfo = {}) => {
  const routedToTeamId = String(caseInfo?.routedToTeamId || '').trim();
  const routeOriginatorTeamId = String(caseInfo?.routeOriginatorTeamId || '').trim();
  return Boolean(routedToTeamId && routeOriginatorTeamId && routedToTeamId !== routeOriginatorTeamId);
};

export const wasRouteSubmittedBack = (caseInfo = {}) => (
  Boolean(caseInfo?.routeReturnedAt || caseInfo?.returnedAt)
  || isTruthyToken(caseInfo?.returnedFromRoute)
  || isTruthyToken(caseInfo?.routeReturnStatus)
  || normalizeToken(caseInfo?.routeStatus) === 'SUBMITTED'
  || normalizeToken(caseInfo?.routingStatus) === 'SUBMITTED'
);

export const getBusinessLifecycleLabel = (caseInfo = {}) => {
  const status = normalizeToken(caseInfo?.status || caseInfo?.statusLabel);
  const state = normalizeToken(caseInfo?.state);
  const lifecycle = normalizeToken(normalizeLifecycle(caseInfo?.lifecycle || caseInfo?.status || caseInfo?.state));
  const rawLifecycle = normalizeToken(caseInfo?.lifecycle);
  const routed = isDocketRouted(caseInfo);

  if (status === 'ROUTED_ASSIGNED') return 'Routed Assigned';
  if (status === 'PENDING' || state === 'PENDED' || rawLifecycle === 'PENDING' || rawLifecycle === 'PENDED' || lifecycle === 'WAITING') return 'Pend';
  if (status === 'FILED' || rawLifecycle === 'FILED' || lifecycle === 'ARCHIVED') return 'File';
  if (status === 'RESOLVED' || rawLifecycle === 'RESOLVED' || lifecycle === 'DONE' || lifecycle === 'COMPLETED') return 'Resolve';
  if (wasRouteSubmittedBack(caseInfo)) return 'Submitted';
  if (routed) return 'Routed';
  return 'Active';
};

export const getBusinessLifecycleTone = (label) => {
  const normalized = normalizeToken(label);
  if (normalized === 'PEND') return 'pend';
  if (normalized === 'FILE') return 'file';
  if (normalized === 'RESOLVE') return 'resolve';
  if (normalized === 'ROUTED') return 'routed';
  if (normalized === 'ROUTED ASSIGNED' || normalized === 'ROUTED_ASSIGNED') return 'routed-assigned';
  if (normalized === 'SUBMITTED') return 'submitted';
  return 'active';
};

const extractPersonLabel = (value) => {
  if (value == null) return '';
  if (typeof value === 'object') {
    return String(
      value.displayName
      || value.name
      || value.fullName
      || value.userName
      || value.xID
      || value.email
      || ''
    ).trim();
  }
  return String(value).trim();
};

export const getDocketAssignedToLabel = (caseInfo = {}) => {
  const candidates = [
    caseInfo?.assignedToName,
    caseInfo?.assignedToDisplayName,
    caseInfo?.assigneeName,
    caseInfo?.assignee,
    caseInfo?.assignedTo,
    caseInfo?.employeeSnapshot,
    caseInfo?.employee,
    caseInfo?.assignedToXID,
    caseInfo?.assigneeXID,
    caseInfo?.employeeXID,
  ];

  const label = candidates
    .map(extractPersonLabel)
    .find((value) => value && !['-', '—', 'UNASSIGNED', 'NONE', 'NULL'].includes(normalizeToken(value)));

  return label || 'Unassigned';
};

export const REALTIME_POLL_MS = 15000;
export const INITIAL_VIRTUAL_WINDOW = 30;
export const ACTION_RETRY_KEY = 'docketra_case_retry_queue';
export const ACTION_RETRY_MAX_ATTEMPTS = 3;
export const ACTION_RETRY_BASE_DELAY_MS = 1000;
