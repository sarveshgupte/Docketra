import { ERROR_CODES } from '../utils/constants';

const BASE_COPY = {
  title: 'Something went wrong',
  message: 'We could not complete that action right now.',
  action: 'Retry in a moment. If it keeps happening, contact your admin or support with the request ID.',
  retryAllowed: true,
  adminActionRequired: false,
  userSafeStatus: 'error',
};

export const ERROR_RECOVERY_COPY = {
  [ERROR_CODES.AUTH_SESSION_EXPIRED]: {
    title: 'Session expired',
    message: 'For security, your session has ended.',
    action: 'Sign in again to continue.',
    retryAllowed: false,
    adminActionRequired: false,
    userSafeStatus: 'session_expired',
  },
  CASE_ACCESS_DENIED: {
    title: 'Access restricted',
    message: 'You no longer have permission to view this area.',
    action: 'Go back to your dashboard or contact your admin if you need access.',
    retryAllowed: false,
    adminActionRequired: true,
    userSafeStatus: 'access_denied',
  },
  [ERROR_CODES.CLIENT_ACCESS_RESTRICTED]: {
    title: 'Client access restricted',
    message: 'This client is not available in your current access scope.',
    action: 'Return to your client list or contact your admin.',
    retryAllowed: false,
    adminActionRequired: true,
    userSafeStatus: 'access_denied',
  },
  [ERROR_CODES.STORAGE_NOT_AVAILABLE]: {
    title: 'Storage temporarily unavailable',
    message: 'Document storage is not ready for uploads right now.',
    action: 'Primary Admin/Admin: verify storage settings. Other users: contact your admin.',
    retryAllowed: true,
    adminActionRequired: true,
    userSafeStatus: 'storage_unavailable',
  },
  [ERROR_CODES.STORAGE_NOT_CONNECTED || 'STORAGE_NOT_CONNECTED']: {
    title: 'Storage setup required',
    message: 'No active storage connection is available for this workspace.',
    action: 'Primary Admin/Admin: configure storage settings. Other users: contact your admin.',
    retryAllowed: false,
    adminActionRequired: true,
    userSafeStatus: 'storage_not_connected',
  },
  [ERROR_CODES.UPLOAD_SESSION_EXPIRED]: {
    title: 'Upload session expired',
    message: 'Your upload session timed out before completion.',
    action: 'Retry upload. If this repeats, contact your admin with the request ID.',
    retryAllowed: true,
    adminActionRequired: false,
    userSafeStatus: 'upload_session_expired',
  },
  [ERROR_CODES.UPLOAD_VERIFICATION_FAILED]: {
    title: 'Upload verification failed',
    message: 'The file could not be verified safely.',
    action: 'Retry with a fresh file copy. Contact your admin if this persists.',
    retryAllowed: true,
    adminActionRequired: true,
    userSafeStatus: 'upload_verification_failed',
  },
  [ERROR_CODES.UPLOAD_CHECKSUM_MISMATCH]: {
    title: 'Upload integrity check failed',
    message: 'The uploaded file did not pass integrity validation.',
    action: 'Retry upload. If it fails again, contact your admin.',
    retryAllowed: true,
    adminActionRequired: true,
    userSafeStatus: 'upload_checksum_mismatch',
  },
  [ERROR_CODES.UPLOAD_SESSION_BACKEND_UNAVAILABLE]: {
    title: 'Upload service unavailable',
    message: 'Upload services are temporarily unavailable.',
    action: 'Retry shortly. If it continues, contact your admin.',
    retryAllowed: true,
    adminActionRequired: true,
    userSafeStatus: 'upload_service_unavailable',
  },
  [ERROR_CODES.TENANT_SCOPE_TAMPERING_DETECTED]: {
    title: 'Request blocked',
    message: 'The request could not be processed for security reasons.',
    action: 'Refresh and continue from your workspace. Contact support if needed.',
    retryAllowed: false,
    adminActionRequired: true,
    userSafeStatus: 'blocked',
  },
  CLIENT_INACTIVE: {
    title: 'Client is inactive',
    message: 'That client is currently inactive and cannot be used for new docket actions.',
    action: 'Choose another active client or ask your admin to reactivate this client.',
    retryAllowed: false,
    adminActionRequired: true,
    userSafeStatus: 'client_inactive',
  },
  ASSIGNEE_INACTIVE: {
    title: 'Assignee unavailable',
    message: 'The selected assignee is inactive and cannot receive new docket work.',
    action: 'Select an active assignee or contact your admin.',
    retryAllowed: false,
    adminActionRequired: true,
    userSafeStatus: 'assignee_inactive',
  },
};

export const getRecoveryCopy = (reasonCode) => {
  if (!reasonCode) return BASE_COPY;
  return ERROR_RECOVERY_COPY[reasonCode] || BASE_COPY;
};
