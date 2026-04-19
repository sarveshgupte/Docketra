import { normalizeLifecycle } from '../../utils/lifecycle';

export const normalizeCase = (data) => data.case || data;

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
