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
  client: detail.client ? {
    ...(legacy.client || {}),
    _id: detail.client.id || legacy?.client?._id,
    clientId: detail.client.clientId || legacy?.client?.clientId,
    businessName: detail.client.name || legacy?.client?.businessName,
    businessEmail: detail.client.email || legacy?.client?.businessEmail,
    primaryContactNumber: detail.client.contact || legacy?.client?.primaryContactNumber,
  } : legacy.client,
});

export const normalizeCase = (data) => {
  const root = data?.case || data || {};
  const detail = root?.docketDetail || data?.docketDetail;
  return detail ? toLegacyCaseShape(detail, root) : root;
};

export const toLifecycleStage = (lifecycle) => {
  if (lifecycle === 'OPEN') return 'Open';
  if (lifecycle === 'IN_PROGRESS') return 'In Progress';
  if (lifecycle === 'RESOLVED') return 'Resolved';
  if (lifecycle === 'CLOSED') return 'Closed';
  return 'Open';
};

export const normalizeLifecycleForUi = (lifecycle) => normalizeLifecycle(lifecycle);

export const REALTIME_POLL_MS = 15000;
export const INITIAL_VIRTUAL_WINDOW = 30;
export const ACTION_RETRY_KEY = 'docketra_case_retry_queue';
export const ACTION_RETRY_MAX_ATTEMPTS = 3;
export const ACTION_RETRY_BASE_DELAY_MS = 1000;
