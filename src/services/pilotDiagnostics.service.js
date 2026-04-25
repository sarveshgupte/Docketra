const log = require('../utils/log');

const REASON_CODES = Object.freeze({
  MISSING_CLIENT: 'missing_client',
  MISSING_ROUTING: 'missing_routing',
  INACTIVE_WORKBENCH: 'inactive_workbench',
  INVALID_ORIGIN: 'invalid_origin',
  REFRESH_NOT_SUPPORTED: 'refresh_not_supported',
  IDEMPOTENT_REPLAY: 'idempotent_replay',
  DUPLICATE_MATCH: 'duplicate_match',
  CONVERSION_FAILED: 'conversion_failed',
  FIRM_CONTEXT_MISSING: 'firm_context_missing',
  SETUP_INCOMPLETE: 'setup_incomplete',
  MISSING_CONTACT: 'missing_contact',
  REPORT_EXPORT_FAILED: 'report_export_failed',
  MISSING_REFRESH_TOKEN: 'missing_refresh_token',
  AUTO_REOPEN_DUE: 'AUTO_REOPEN_DUE',
  STORAGE_EXPORT_FAILED: 'storage_export_failed',
  EXPORT_DOWNLOAD_UNAVAILABLE: 'export_download_unavailable',
  BACKUP_RUNS_FETCH_FAILED: 'backup_runs_fetch_failed',
});

const buildWarning = ({ code, message, recovery = null, context = null }) => ({
  code,
  message,
  recovery,
  context: context && typeof context === 'object' ? context : null,
});

const summarizeWarnings = (warningDetails = []) => warningDetails
  .filter((entry) => entry && typeof entry.message === 'string')
  .map((entry) => entry.message);

const logPilotEvent = ({ event, severity = 'info', metadata = {} }) => {
  const payload = {
    eventType: 'pilot_ops',
    ...metadata,
  };

  if (severity === 'warn') {
    log.warn(event, payload);
    return;
  }
  if (severity === 'error') {
    log.error(event, payload);
    return;
  }
  log.info(event, payload);
};

module.exports = {
  REASON_CODES,
  buildWarning,
  summarizeWarnings,
  logPilotEvent,
};
