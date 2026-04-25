import { getRecoveryCopy } from '../constants/errorRecoveryCopy';
import { ERROR_CODES } from './constants';

export const resolveReasonCode = (error) => {
  const code = error?.code || error?.data?.code || error?.response?.data?.code;
  if (typeof code === 'string' && code.trim()) return code.trim();
  if (error?.status === 403 || error?.response?.status === 403) return 'CASE_ACCESS_DENIED';
  if (error?.status === 401 || error?.response?.status === 401) return ERROR_CODES.AUTH_SESSION_EXPIRED;
  return 'UNKNOWN';
};

export const buildSupportContext = (error, module = 'workspace') => {
  const reasonCode = resolveReasonCode(error);
  const recovery = getRecoveryCopy(reasonCode);
  return {
    requestId: error?.requestId || error?.data?.requestId || error?.response?.headers?.['x-request-id'] || null,
    reasonCode,
    module,
    timestamp: new Date().toISOString(),
    status: recovery.userSafeStatus,
  };
};

export const getRecoveryPayload = (error, module = 'workspace') => {
  const reasonCode = resolveReasonCode(error);
  return {
    reasonCode,
    copy: getRecoveryCopy(reasonCode),
    supportContext: buildSupportContext(error, module),
  };
};
