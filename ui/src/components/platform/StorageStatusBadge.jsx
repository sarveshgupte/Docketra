import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import useStorageStatusSummary, { invalidateStorageStatusSummaryCache } from '../../hooks/useStorageStatusSummary';
import { recoverStorageRoot } from '../../services/storageService';
import { ROUTES, hasValidFirmSlug } from '../../constants/routes';
import { useAuth } from '../../hooks/useAuth';
import { hasFirmRoleAtLeast, isFirmAdminOrAbove, isPrimaryAdmin } from '../../utils/roleHierarchy';

const formatDateTime = (value) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

export default function StorageStatusBadge() {
  const { firmSlug } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const containerRef = useRef(null);
  const canViewStorageStatus = hasFirmRoleAtLeast(user, 'MANAGER');
  const canReadOwnershipSummary = isFirmAdminOrAbove(user);
  const canReadRootHealth = isPrimaryAdmin(user) || Boolean(user?.isPrimaryAdmin);

  const handleRecover = async () => {
    try {
      setRecovering(true);
      await recoverStorageRoot();
      invalidateStorageStatusSummaryCache();
    } catch {
      // navigation to settings will still allow explicit diagnostics
    } finally {
      setRecovering(false);
    }
  };
  const inferredFirmSlug = useMemo(() => {
    const match = String(location.pathname || '').match(/^\/app\/firm\/([^/]+)/i);
    return match?.[1] ? decodeURIComponent(match[1]) : '';
  }, [location.pathname]);
  const activeFirmSlug = hasValidFirmSlug(firmSlug) ? firmSlug : inferredFirmSlug;
  const statusFirmSlug = canViewStorageStatus ? activeFirmSlug : '';
  const bypassCache = String(location.pathname || '').includes('/storage-settings');
  const summary = useStorageStatusSummary(statusFirmSlug, {
    bypassCache,
    includeOwnershipSummary: canReadOwnershipSummary,
    includeRootHealth: canReadRootHealth,
  });

  const storageSettingsPath = useMemo(() => {
    const path = String(summary.storageSettingsPath || '').trim();
    return path.startsWith('/app/firm/') ? path : ROUTES.STORAGE_SETTINGS(activeFirmSlug);
  }, [summary.storageSettingsPath, activeFirmSlug]);

  const dataStorageMapPath = useMemo(() => {
    const path = String(summary.dataStorageMapPath || '').trim();
    return path.startsWith('/app/firm/') ? path : ROUTES.DATA_STORAGE_MAP(activeFirmSlug);
  }, [summary.dataStorageMapPath, activeFirmSlug]);

  useEffect(() => {
    const onClick = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (!activeFirmSlug || !canViewStorageStatus) return null;

  return (
    <div className="platform__storage-badge" ref={containerRef}>
      <button
        type="button"
        className={`platform__storage-pill platform__storage-pill--${summary.badgeTone}`}
        aria-label={`Storage status: ${summary.badgeLabel}`}
        aria-expanded={open}
        aria-controls="storage-status-popover"
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
        title={summary.helperText}
      >
        <span className="platform__storage-dot" aria-hidden="true" />
        <span className="platform__storage-label-long">{summary.badgeLabel}</span>
        <span className="platform__storage-label-short">Storage</span>
      </button>
      {open ? (
        <div id="storage-status-popover" className="platform__storage-popover" role="dialog" aria-label="Storage status details">
          <div className="platform__storage-header">
            <span className="platform__storage-title">Storage Status</span>
            <span className={`platform__storage-status-badge platform__storage-status-badge--${summary.badgeTone}`}>
              <span className="platform__storage-dot" aria-hidden="true" />
              {summary.statusLabel || 'Active'}
            </span>
          </div>

          <p className="platform__storage-helper">
            {summary.isByosActive
              ? 'Client files and statutory filings are saved directly to your firm\'s Google Drive.'
              : summary.helperText}
          </p>

          <dl className="platform__storage-meta">
            <div>
              <dt>Storage</dt>
              <dd>{summary.providerLabel}</dd>
            </div>
            {summary.connectedEmail ? (
              <div>
                <dt>Account</dt>
                <dd>{summary.connectedEmail}</dd>
              </div>
            ) : null}
            <div>
              <dt>Last verified</dt>
              <dd>{formatDateTime(summary.lastCheckedAt)}</dd>
            </div>
          </dl>

          {summary.needsAttention && canReadRootHealth && (
            <div className="pt-2 pb-1">
              <button
                type="button"
                className="w-full text-xs font-semibold py-1.5 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition flex items-center justify-center gap-1.5 shadow-sm"
                onClick={handleRecover}
                disabled={recovering}
              >
                {recovering ? 'Recovering Google Drive…' : '↻ Recover Storage Root'}
              </button>
            </div>
          )}

          <div className="platform__storage-links">
            <Link className="platform__storage-link platform__storage-link--primary" to={storageSettingsPath} onClick={() => setOpen(false)}>Storage Settings</Link>
            <Link className="platform__storage-link" to={dataStorageMapPath} onClick={() => setOpen(false)}>Data Storage Map</Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
