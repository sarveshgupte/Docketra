import React, { useContext, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PlatformShell } from '../components/platform/PlatformShell';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Select } from '../components/common/Select';
import { ToastContext } from '../contexts/ToastContext';
import {
  changeStorageProvider,
  connectGoogleDrive,
  getStorageConfiguration,
  getStorageOwnershipSummary,
  getStorageFolderLink,
  sendStorageChangeOtp,
  testStorageConnection,
  disconnectStorage,
  verifyStorageChangeOtp,
  exportFirmStorage,
  listStorageExports,
  getStorageUsage,
} from '../services/storageService';
import { useAuth } from '../hooks/useAuth';
import { adminApi } from '../api/admin.api';
import { spacingClasses } from '../theme/tokens';
import { PageHeader } from '../components/layout/PageHeader';
import { formatDateTime } from '../utils/formatDateTime';
import { getRecoveryPayload } from '../utils/errorRecovery';
import { SupportContext } from '../components/feedback/SupportContext';
import { StatusMessageStack } from './platform/PlatformShared';
import { ROUTES } from '../constants/routes';

const PAGE_SUBTITLE = 'Docketra-managed storage works by default. You can optionally connect your firm’s own Google Drive.';

function getExportHistoryWarning(error) {
  const status = Number(error?.response?.status || 0);
  const errorCode = error?.response?.data?.code || error?.response?.data?.error;

  if (status === 403) return 'Export history is visible to primary admins only.';
  if (status === 400 && errorCode === 'STORAGE_NOT_CONNECTED') return 'Export history will appear after a storage provider is connected.';
  if (status === 404) return 'Export history endpoint is not available in this environment yet.';

  return 'Export history is temporarily unavailable.';
}

export function StorageSettingsPage() {
  const toast = useContext(ToastContext);
  const { user } = useAuth();
  const location = useLocation();

  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [savingProvider, setSavingProvider] = useState(false);
  const [provider, setProvider] = useState('onedrive');
  const [otpCode, setOtpCode] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [oneDriveRefreshToken, setOneDriveRefreshToken] = useState('');
  const [oneDriveDriveId, setOneDriveDriveId] = useState('');
  const [s3Bucket, setS3Bucket] = useState('');
  const [s3Region, setS3Region] = useState('');
  const [s3Prefix, setS3Prefix] = useState('');
  const [s3AccessKeyId, setS3AccessKeyId] = useState('');
  const [s3SecretAccessKey, setS3SecretAccessKey] = useState('');
  const [s3SessionToken, setS3SessionToken] = useState('');
  const [loadError, setLoadError] = useState('');
  const [summaryWarning, setSummaryWarning] = useState('');
  const [exportWarning, setExportWarning] = useState('');
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });
  const [supportContext, setSupportContext] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [ownershipSummary, setOwnershipSummary] = useState(null);
  const [usage, setUsage] = useState(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState('');
  const [openingFolder, setOpeningFolder] = useState(false);
  const [folderLinkAvailable, setFolderLinkAvailable] = useState(false);
  const [folderLinkUrl, setFolderLinkUrl] = useState('');
  const [strictModeSaving, setStrictModeSaving] = useState(false);

  const loadStorageUsage = async () => {
    setUsageLoading(true);
    setUsageError('');
    try {
      const usageData = await getStorageUsage();
      setUsage(usageData);
    } catch (error) {
      setUsage(null);
      setUsageError(error?.response?.data?.error || 'Storage usage is temporarily unavailable.');
    } finally {
      setUsageLoading(false);
    }
  };

  const loadConfiguration = async () => {
    setLoading(true);
    setLoadError('');
    setSummaryWarning('');
    setExportWarning('');

    try {
      const data = await getStorageConfiguration();
      setConfig(data);

      const [summaryResult, exportsResult, folderResult] = await Promise.allSettled([
        getStorageOwnershipSummary(),
        listStorageExports(10),
        getStorageFolderLink(),
      ]);

      if (summaryResult.status === 'fulfilled') {
        setOwnershipSummary(summaryResult.value);
      } else {
        setOwnershipSummary(null);
        setSummaryWarning('Storage ownership summary is temporarily unavailable.');
      }

      if (folderResult.status === 'fulfilled' && folderResult.value?.folderUrl) {
        setFolderLinkAvailable(true);
        setFolderLinkUrl(folderResult.value.folderUrl);
      } else {
        setFolderLinkAvailable(false);
        setFolderLinkUrl('');
      }

      if (exportsResult.status !== 'fulfilled') {
        setExportWarning(getExportHistoryWarning(exportsResult.reason));
      }
      await loadStorageUsage();
    } catch (error) {
      const status = Number(error?.response?.status || 0);
      const requestId = error?.response?.headers?.['x-request-id'] || error?.response?.headers?.['x-correlation-id'];
      if (status === 404) {
        setLoadError(`Storage settings API route is unavailable. Contact support with request ID.${requestId ? ` Request ID: ${requestId}.` : ''}`);
        setSupportContext({ area: 'storage_settings', status, requestId: requestId || null });
      } else {
        const recovery = getRecoveryPayload(error, 'storage_settings');
        setLoadError(`${recovery.copy.message} ${recovery.copy.action}`);
        setSupportContext(recovery.supportContext);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfiguration();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const providerParam = params.get('provider');
    const connected = params.get('connected');
    const error = params.get('error');

    if (providerParam === 'google-drive' && connected === '1') {
      setStatusMessage({ type: 'success', text: 'Google Drive connected successfully. Future uploads will use firm-owned Google Drive.' });
      toast?.showSuccess?.('Google Drive connected successfully.');
      loadConfiguration();
    }

    if (error) {
      setStatusMessage({ type: 'error', text: 'Google Drive connection was not completed. Docketra-managed storage is still active.' });
    }
  }, [location.search]);

  const currentProvider = config?.provider || 'docketra_managed';
  const normalizedProvider = currentProvider === 'google_drive' ? 'google-drive' : currentProvider;
  const isGoogleConnected = normalizedProvider === 'google-drive' && Boolean(config?.isConfigured);
  const currentModeLabel = isGoogleConnected ? 'Firm-owned Google Drive' : 'Docketra-managed Google Drive';
  const statusLabel = config?.status?.includes('ERROR') || config?.status?.includes('DISCONNECTED') ? 'Needs attention' : config?.isConfigured ? 'Active' : 'Not connected';
  const usagePercent = Number(usage?.usagePercent || 0);
  const strictFirmOwnedStorage = Boolean(config?.strictFirmOwnedStorage);



  const onToggleStrictMode = async (nextValue) => {
    if (nextValue && !isGoogleConnected) {
      setStatusMessage({ type: 'error', text: 'Connect firm Google Drive before enabling strict mode.' });
      return;
    }
    const copy = nextValue
      ? 'Enable Strict firm-owned storage mode? This disables Docketra-managed fallback for business-content writes.'
      : 'Disable Strict firm-owned storage mode? This re-enables Docketra-managed fallback storage.';
    if (!window.confirm(copy)) return;
    setStrictModeSaving(true);
    try {
      await adminApi.updateFirmSettings({ firm: { strictFirmOwnedStorage: nextValue } });
      setStatusMessage({ type: 'success', text: nextValue ? 'Strict firm-owned storage mode enabled.' : 'Strict firm-owned storage mode disabled.' });
      await loadConfiguration();
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to update strict storage mode.';
      setStatusMessage({ type: 'error', text: message });
    } finally {
      setStrictModeSaving(false);
    }
  };

  const onSaveStorageSettings = async () => {
    setSavingProvider(true);
    try {
      let credentials = {};
      if (provider === 'onedrive') {
        credentials = { refreshToken: oneDriveRefreshToken, driveId: oneDriveDriveId || null };
      }
      if (provider === 's3') {
        credentials = {
          bucket: s3Bucket,
          region: s3Region,
          prefix: s3Prefix || '',
          accessKeyId: s3AccessKeyId || undefined,
          secretAccessKey: s3SecretAccessKey || undefined,
          sessionToken: s3SessionToken || undefined,
        };
      }

      await changeStorageProvider({ provider, verificationToken, credentials });
      setStatusMessage({ type: 'success', text: 'Advanced provider settings updated.' });
      await loadConfiguration();
    } catch (error) {
      const recovery = getRecoveryPayload(error, 'storage_settings');
      setStatusMessage({ type: 'error', text: `${recovery.copy.message} ${recovery.copy.action}` });
    } finally {
      setSavingProvider(false);
    }
  };

  const onSendOtp = async () => {
    try {
      await sendStorageChangeOtp(user?.email);
      setStatusMessage({ type: 'success', text: 'OTP sent. Check your email and enter the code below.' });
      toast?.showSuccess?.('OTP sent.');
    } catch (error) {
      const recovery = getRecoveryPayload(error, 'storage_settings');
      const message = `${recovery.copy.message} ${recovery.copy.action}`;
      setStatusMessage({ type: 'error', text: message });
      toast?.showError?.('Unable to send OTP right now.');
    }
  };

  const onVerifyOtp = async () => {
    try {
      const result = await verifyStorageChangeOtp(user?.email, otpCode);
      setVerificationToken(result?.data?.verificationToken || '');
      setStatusMessage({ type: 'success', text: 'OTP verified. You can now save advanced provider settings.' });
      toast?.showSuccess?.('OTP verified.');
    } catch (error) {
      const recovery = getRecoveryPayload(error, 'storage_settings');
      const message = `${recovery.copy.message} ${recovery.copy.action}`;
      setStatusMessage({ type: 'error', text: message });
      toast?.showError?.('OTP verification failed.');
    }
  };

  const onTestConnection = async () => {
    setTesting(true);
    try {
      await testStorageConnection();
      setStatusMessage({ type: 'success', text: 'Storage connection test passed.' });
      await loadConfiguration();
    } catch (error) {
      const recovery = getRecoveryPayload(error, 'storage_settings');
      setStatusMessage({ type: 'error', text: `${recovery.copy.message} ${recovery.copy.action}` });
    } finally {
      setTesting(false);
    }
  };

  const onDisconnectGoogle = async () => {
    const confirmed = window.confirm('Disconnect firm Google Drive? Future uploads will use Docketra-managed storage.');
    if (!confirmed) return;
    setDisconnecting(true);
    try {
      await disconnectStorage();
      setStatusMessage({ type: 'success', text: 'Firm Google Drive disconnected. Docketra-managed storage is active.' });
      toast?.showSuccess?.('Firm Google Drive disconnected.');
      await loadConfiguration();
    } catch (error) {
      const recovery = getRecoveryPayload(error, 'storage_settings');
      setStatusMessage({ type: 'error', text: `${recovery.copy.message} ${recovery.copy.action}` });
      toast?.showError?.('Unable to disconnect firm Google Drive.');
    } finally {
      setDisconnecting(false);
    }
  };

  const onGenerateExport = async () => {
    setExporting(true);
    try {
      await exportFirmStorage();
      setStatusMessage({ type: 'success', text: 'Export started successfully.' });
      toast?.showSuccess?.('Storage export generated.');
      await loadConfiguration();
    } catch (error) {
      const recovery = getRecoveryPayload(error, 'storage_settings');
      setStatusMessage({ type: 'error', text: `${recovery.copy.message} ${recovery.copy.action}` });
      toast?.showError?.('Unable to generate storage export.');
    } finally {
      setExporting(false);
    }
  };

  const onOpenStorageFolder = async () => {
    setOpeningFolder(true);
    try {
      const data = folderLinkUrl ? { folderUrl: folderLinkUrl } : await getStorageFolderLink();
      if (!data?.folderUrl) throw new Error('folder_link_unavailable');
      setFolderLinkAvailable(true);
      setFolderLinkUrl(data.folderUrl);
      window.open(data.folderUrl, '_blank', 'noopener,noreferrer');
      setStatusMessage({ type: 'success', text: 'Storage folder opened.' });
      toast?.showSuccess?.('Opened storage folder.');
    } catch {
      setFolderLinkAvailable(false);
      setFolderLinkUrl('');
      setStatusMessage({ type: 'error', text: 'Folder link unavailable.' });
      toast?.showError?.('Folder link unavailable.');
    } finally {
      setOpeningFolder(false);
    }
  };

  const statusMessages = [
    loadError ? { tone: 'error', message: loadError } : null,
    statusMessage.text ? { tone: statusMessage.type === 'error' ? 'error' : 'success', message: statusMessage.text } : null,
  ].filter(Boolean);

  if (loading) {
    return (
      <PlatformShell moduleLabel="Settings" title="Storage settings">
        <div className="p-8">Loading…</div>
      </PlatformShell>
    );
  }

  return (
    <PlatformShell moduleLabel="Settings" title="Storage settings" subtitle={PAGE_SUBTITLE}>
      <div className="min-h-screen bg-[var(--dt-bg-warm)]">
        <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 space-y-6">
          <PageHeader title="Storage Settings" subtitle={PAGE_SUBTITLE} />
          <StatusMessageStack messages={statusMessages} />

          <Card><div className={spacingClasses.sectionMargin}><h2 className="text-lg font-medium">Storage overview</h2><p>Active mode: {currentModeLabel}</p><p>Status: {statusLabel}</p>{isGoogleConnected ? <p>Connected account: {config?.connectedEmail || 'N/A'}</p> : null}<p>Last checked: {formatDateTime(ownershipSummary?.lastHealthCheck?.checkedAt || config?.updatedAt)}</p><p className="text-sm text-[var(--dt-text-muted)]">Docketra stores business files in the active storage provider. MongoDB stores only control-plane metadata.</p><div className="flex flex-wrap gap-2 mt-3">{isGoogleConnected ? <><Button type="button" variant="outline" onClick={onOpenStorageFolder} disabled={openingFolder}>{openingFolder ? 'Opening folder…' : 'Open storage folder'}</Button><Button type="button" variant="outline" onClick={onTestConnection} disabled={testing}>{testing ? 'Testing…' : 'Test connection'}</Button><Button type="button" variant="primary" onClick={connectGoogleDrive}>Refresh Google Drive connection</Button><Button type="button" variant="outline" onClick={onDisconnectGoogle} disabled={disconnecting}>{disconnecting ? 'Disconnecting…' : 'Disconnect firm Google Drive'}</Button></> : <Button type="button" variant="primary" onClick={connectGoogleDrive}>Connect firm Google Drive</Button>}</div>{!folderLinkAvailable && isGoogleConnected ? <p className="text-sm text-[var(--dt-text-muted)] mt-2">Folder link unavailable.</p> : null}{summaryWarning ? <p className="text-sm text-[var(--dt-warning)] mt-2">{summaryWarning}</p> : null}</div></Card>

          <Card><div className={spacingClasses.sectionMargin}><h2 className="text-lg font-medium">Firm-owned Google Drive</h2>{!isGoogleConnected ? <><ul className="list-disc ml-6 text-sm space-y-1"><li>Your files stay in your firm’s Google Drive.</li><li>Docketra uses Drive only after Primary Admin approval.</li><li>You can disconnect anytime.</li></ul><Button type="button" variant="primary" onClick={connectGoogleDrive}>Connect firm Google Drive</Button></> : <><p>Connected email: {config?.connectedEmail || 'N/A'}</p><p>Status: {statusLabel}</p><p>Last checked: {formatDateTime(ownershipSummary?.lastHealthCheck?.checkedAt || config?.updatedAt)}</p><p className="text-sm text-[var(--dt-text-muted)]">Future uploads use firm-owned Google Drive.</p><div className="flex flex-wrap gap-2 mt-2"><Button type="button" variant="primary" onClick={connectGoogleDrive}>Refresh Google Drive connection</Button><Button type="button" variant="outline" onClick={onDisconnectGoogle} disabled={disconnecting}>{disconnecting ? 'Disconnecting…' : 'Disconnect firm Google Drive'}</Button></div></>}</div></Card>

          <Card><div className={spacingClasses.sectionMargin}><h2 className="text-lg font-medium">Storage capacity</h2>{usageLoading ? <p>Loading usage…</p> : null}{!usageLoading && usage?.managedFallback ? <p>Docketra-managed storage is active. Storage quota is managed by Docketra.</p> : null}{!usageLoading && !usage?.managedFallback && usage?.quotaAvailable ? <><p>Used: {usage.displayUsed}</p><p>Available: {usage.displayAvailable}</p><p>Total: {usage.displayTotal}</p><p>Usage: {Math.round(usagePercent)}%</p><div className="mt-2 h-2 w-full rounded bg-[var(--dt-border)]"><div className="h-2 rounded bg-[var(--dt-primary)]" style={{ width: `${Math.max(0, Math.min(100, usagePercent))}%` }} /></div>{usagePercent >= 95 ? <p className="text-sm text-[var(--dt-warning)] mt-2">Uploads may fail if Drive is full.</p> : null}{usagePercent >= 85 && usagePercent < 95 ? <p className="text-sm text-[var(--dt-warning)] mt-2">Upgrade Google Drive storage soon.</p> : null}{usagePercent >= 70 && usagePercent < 85 ? <p className="text-sm text-[var(--dt-warning)] mt-2">Storage is filling up.</p> : null}<p className="text-sm text-[var(--dt-text-muted)] mt-2">Last checked: {formatDateTime(usage.lastCheckedAt)}</p></> : null}{!usageLoading && !usage?.managedFallback && !usage?.quotaAvailable ? <p>Storage quota is not available for this Drive account.</p> : null}{usageError ? <p className="text-sm text-[var(--dt-warning)]">{usageError}</p> : null}<Button type="button" variant="outline" onClick={loadStorageUsage} disabled={usageLoading}>{usageLoading ? 'Refreshing usage…' : 'Refresh usage'}</Button></div></Card>

          <Card><div className={spacingClasses.sectionMargin}><h2 className="text-lg font-medium">Data storage map</h2><p>Client profiles → firm cloud profile.json</p><p>CFS and attachments → firm cloud folders/files</p><p>MongoDB → control-plane metadata only</p><details className="mt-2"><summary className="cursor-pointer">View technical storage paths</summary><p className="font-medium mt-2">Google Drive folder paths</p><ul className="list-disc ml-6 text-sm">{(ownershipSummary?.dataStorageMap?.googleDriveFolderPaths || []).map((item) => <li key={item.key}>{item.key}: {item.path}</li>)}</ul><p className="font-medium mt-2">MongoDB control-plane metadata categories</p><ul className="list-disc ml-6 text-sm">{(ownershipSummary?.dataStorageMap?.mongoControlPlaneMetadata || []).map((item) => <li key={item}>{item}</li>)}</ul></details><Link className="text-sm underline text-[var(--dt-link)]" to={ROUTES.DATA_STORAGE_MAP(config?.firmSlug || user?.firmSlug || '')}>Open Data Storage Map</Link></div></Card>

          <Card><div className={spacingClasses.sectionMargin}><h2 className="text-lg font-medium">Backup and export</h2><p className="text-sm">Generate an export of storage metadata, references, and supported files. Secrets and credentials are never included.</p><Button type="button" variant="primary" onClick={onGenerateExport} disabled={exporting}>{exporting ? 'Generating…' : 'Generate storage export'}</Button>{exportWarning ? <p className="text-sm text-[var(--dt-warning)]">{exportWarning}</p> : null}</div></Card>

          <Card><div className={spacingClasses.sectionMargin}><details><summary className="cursor-pointer font-medium">Advanced manual providers</summary><p className="text-sm mt-2">Most firms should not use this. Use Google Drive BYOS unless Docketra support instructs otherwise.</p><p className="text-sm text-[var(--dt-text-muted)] mt-1">Manual credentials are sensitive and should only be entered when instructed by support.</p><SupportContext context={supportContext} /><div className="mt-3"><Select label="Manual provider" value={provider} onChange={(event) => setProvider(event.target.value)} options={[{ value: 'onedrive', label: 'Microsoft OneDrive — manual setup only' }, { value: 's3', label: 'Amazon S3 — advanced setup' }]} />{provider === 'onedrive' ? <><Input label="OneDrive Refresh Token" value={oneDriveRefreshToken} onChange={(event) => setOneDriveRefreshToken(event.target.value)} /><Input label="OneDrive Drive ID (optional)" value={oneDriveDriveId} onChange={(event) => setOneDriveDriveId(event.target.value)} /></> : null}{provider === 's3' ? <><Input label="S3 Bucket" value={s3Bucket} onChange={(event) => setS3Bucket(event.target.value)} /><Input label="S3 Region" value={s3Region} onChange={(event) => setS3Region(event.target.value)} /><Input label="S3 Prefix (optional)" value={s3Prefix} onChange={(event) => setS3Prefix(event.target.value)} /><Input label="S3 Access Key ID (optional)" value={s3AccessKeyId} onChange={(event) => setS3AccessKeyId(event.target.value)} /><Input label="S3 Secret Access Key (optional)" value={s3SecretAccessKey} onChange={(event) => setS3SecretAccessKey(event.target.value)} /><Input label="S3 Session Token (optional)" value={s3SessionToken} onChange={(event) => setS3SessionToken(event.target.value)} /></> : null}<div className="grid grid-cols-1 gap-3 md:grid-cols-3 items-end"><Input label="OTP Code" value={otpCode} onChange={(event) => setOtpCode(event.target.value)} /><Button type="button" variant="outline" onClick={onSendOtp}>Send OTP</Button><Button type="button" variant="outline" onClick={onVerifyOtp}>Verify OTP</Button></div><Button type="button" variant="primary" onClick={onSaveStorageSettings} disabled={!verificationToken || savingProvider}>{savingProvider ? 'Saving…' : 'Save Provider'}</Button></div></details></div></Card>
        </div>
      </div>
    </PlatformShell>
  );
}

export default StorageSettingsPage;
