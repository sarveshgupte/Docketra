/**
 * Response Contract Middleware
 * 
 * Normalizes error responses to a single envelope:
 * {
 *   success: false,
 *   code: 'MACHINE_READABLE_CODE',
 *   message: 'Human readable message',
 *   requestId: 'req-uuid',
 *   action: 'retry | contact_admin | refresh | read_only_mode | retry_after_*'
 * }
 */

const deriveCode = (payload, statusCode) => {
  if (payload?.code) return String(payload.code);
  if (payload?.error) return String(payload.error);
  if (statusCode === 404) return 'NOT_FOUND';
  if (statusCode === 401) return 'UNAUTHORIZED';
  if (statusCode === 403) return 'FORBIDDEN';
  if (statusCode === 429) return 'RATE_LIMITED';
  if (statusCode === 503) return 'SERVICE_UNAVAILABLE';
  return 'SERVER_ERROR';
};

const deriveAction = (statusCode, payload) => {
  if (payload?.action) return payload.action;
  if (statusCode === 429) {
    const retryAfter = payload?.retryAfter || payload?.retry_after;
    return retryAfter ? `retry_after_${retryAfter}s` : 'retry_after';
  }
  if (statusCode === 503) return 'read_only_mode';
  if (statusCode >= 500) return 'contact_admin';
  return 'retry';
};

const responseContract = (req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = (payload) => {
    const statusCode = res.statusCode || 200;
    const isError = (statusCode >= 400) || (payload && payload.success === false);

    if (payload && typeof payload === 'object' && isError) {
      const response = {
        success: false,
        code: deriveCode(payload, statusCode),
        message: payload.message || payload.error || 'Request failed',
        requestId: req.requestId,
        action: deriveAction(statusCode, payload),
      };

      if (payload.details) response.details = payload.details;
      if (payload.retryAfter || payload.retry_after) response.retryAfter = payload.retryAfter || payload.retry_after;
      if (payload.systemState) response.systemState = payload.systemState;
      if (payload.lockedBy) response.lockedBy = payload.lockedBy;
      if (payload.target) response.target = payload.target;

      return originalJson(response);
    }

    return originalJson(payload);
  };

  return next();
};

module.exports = responseContract;
