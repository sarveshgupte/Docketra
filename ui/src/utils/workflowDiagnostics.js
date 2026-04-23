const MAX_EVENTS = 80;
const WARN_TTL_MS = 20000;

const events = [];
const warningKeys = new Map();

const nowIso = () => new Date().toISOString();

export const createCorrelationId = (workflow = 'workflow') => {
  const suffix = Math.random().toString(36).slice(2, 10);
  return `${workflow}-${Date.now()}-${suffix}`;
};

export const shouldEmitWarning = (key) => {
  const last = warningKeys.get(key);
  const now = Date.now();
  if (!last || now - last > WARN_TTL_MS) {
    warningKeys.set(key, now);
    return true;
  }
  return false;
};

export const emitDiagnosticEvent = (level, event, context = {}) => {
  const payload = {
    ts: nowIso(),
    level,
    event,
    ...context,
  };
  events.push(payload);
  if (events.length > MAX_EVENTS) events.shift();

  if (typeof window !== 'undefined') {
    window.__DOCKETRA_DIAGNOSTICS__ = events;
    window.dispatchEvent(new CustomEvent('docketra:diagnostic', { detail: payload }));
  }

  const method = console[level] || console.info;
  method(`[diag] ${event}`, payload);
};

export const getRecentDiagnostics = () => [...events];
