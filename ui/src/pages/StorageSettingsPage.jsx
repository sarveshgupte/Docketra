import React, { useContext, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
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
  getStorageRootHealth,
  sendStorageChangeOtp,
  testStorageConnection,
  disconnectStorage,
  verifyStorageChangeOtp,
  exportFirmStorage,
  listStorageExports,
  getStorageUsage,
  initiateStorageRestore,
  getStorageRestoreStatus,
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
import { invalidateStorageStatusSummaryCache } from '../hooks/useStorageStatusSummary';

const PAGE_SUBTITLE = 'Docketra-managed storage works by default. You can optionally connect your firm’s own cloud storage bucket or drive.';

// Custom vector illustrations for cloud providers
const GoogleDriveIcon = ({ className = 'h-8 w-8' }) => (
  <svg className={className} viewBox="0 0 87.3 78" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6.6 78l17.5-30.2h56.6L63.2 78H6.6z" fill="#0b57d0"/>
    <path d="M63.2 78L87.3 36.3 70.8 7.8 46.7 49.5 63.2 78z" fill="#00ac47"/>
    <path d="M24.1 47.8L0 6.1 16.5 6.1l40.7 70.4L24.1 47.8z" fill="#ea4335"/>
    <path d="M57.2 76.5L16.5 6.1H49.5l40.7 70.4H57.2z" fill="#ffba00"/>
  </svg>
);

const OneDriveIcon = ({ className = 'h-8 w-8' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" fill="url(#onedrive-gradient)"/>
    <defs>
      <linearGradient id="onedrive-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#00a1f1" />
        <stop offset="100%" stopColor="#0078d4" />
      </linearGradient>
    </defs>
  </svg>
);

const S3Icon = ({ className = 'h-8 w-8' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="3" width="18" height="18" rx="3" stroke="#ff9900" strokeWidth="2" fill="#ff9900" fillOpacity="0.1"/>
    <path d="M12 7v10M8 11l4-4 4 4" stroke="#ff9900" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ShieldIcon = ({ className = 'h-5 w-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const DatabaseIcon = ({ className = 'h-5 w-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="12" cy="5" rx="9" ry="3" stroke="currentColor" strokeWidth="2"/>
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" stroke="currentColor" strokeWidth="2"/>
    <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" stroke="currentColor" strokeWidth="2"/>
  </svg>
);

function getExportHistoryWarning(error) {
  const status = Number(error?.response?.status || 0);
  const errorCode = error?.response?.data?.code || error?.response?.data?.error;

  if (status === 403) return 'Export history is visible to primary admins only.';
  if (status === 400 && errorCode === 'STORAGE_NOT_CONNECTED') return 'Export history will appear after a storage provider is connected.';
  if (status === 404) return 'Export history endpoint is not available in this environment yet.';

  return 'Export history is temporarily unavailable.';
}

export function StorageSettingsPage() {
  const navigate = useNavigate();
  const { firmSlug } = useParams();
  const toast = useContext(ToastContext);
  const { user } = useAuth();
  const location = useLocation();

  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [savingProvider, setSavingProvider] = useState(false);
  const [providerTab, setProviderTab] = useState('google-drive');
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
  const [rootHealth, setRootHealth] = useState(null);

  // Restore states
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [restoreStatus, setRestoreStatus] = useState('');
  const [restoreJobId, setRestoreJobId] = useState('');
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreFile, setRestoreFile] = useState(null);
  const [restoreExportId, setRestoreExportId] = useState('');
  const [restoreOtpCode, setRestoreOtpCode] = useState('');
  const [restoreVerificationToken, setRestoreVerificationToken] = useState('');
  const [restoreSourceMode, setRestoreSourceMode] = useState('past_job');
  const [restoreErrorMsg, setRestoreErrorMsg] = useState('');

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
      if (data?.provider) {
        const mappedTab = data.provider === 'google_drive' ? 'google-drive' : data.provider;
        setProviderTab(mappedTab);
      }

      const [summaryResult, exportsResult, folderResult, rootHealthResult] = await Promise.allSettled([
        getStorageOwnershipSummary(),
        listStorageExports(10),
        getStorageFolderLink(),
        getStorageRootHealth(),
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
      if (rootHealthResult.status === 'fulfilled') setRootHealth(rootHealthResult.value);
      else setRootHealth(null);

      if (exportsResult.status !== 'fulfilled') {
        setExportWarning(getExportHistoryWarning(exportsResult.reason));
      }
      invalidateStorageStatusSummaryCache();
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
  const normalizedProvider = (currentProvider === 'google_drive' || currentProvider === 'google-drive') ? 'google-drive' : currentProvider;
  const isGoogleConnected = normalizedProvider === 'google-drive' && Boolean(config?.isConfigured);
  const currentModeLabel = normalizedProvider === 'google-drive' ? 'Firm-owned Google Drive' : config?.provider === 'onedrive' ? 'Firm-owned Microsoft OneDrive' : config?.provider === 's3' ? 'Firm-owned Amazon S3' : 'Docketra-managed Google Drive';
  const usagePercent = Number(usage?.usagePercent || 0);
  const strictFirmOwnedStorage = Boolean(config?.strictFirmOwnedStorage);
  const rootHealthStatus = String(rootHealth?.status || '').toLowerCase();
  const rootHealthOk = rootHealthStatus === 'healthy' || rootHealthStatus === 'renamed_valid';
  const credentialsNeedAttention = String(config?.status || '').includes('ERROR') || String(config?.status || '').includes('DISCONNECTED');
  const rootNeedsAttention = normalizedProvider === 'google-drive' && Boolean(config?.isConfigured) && rootHealthStatus === 'recovery_required';
  const storageNeedsAttention = credentialsNeedAttention || rootNeedsAttention;
  const statusLabel = storageNeedsAttention ? 'Needs attention' : config?.isConfigured ? 'Active' : 'Not connected';
  const rootHealthMessage = rootHealth?.message || (config?.isConfigured ? 'Docketra could not verify your firm-owned cloud storage root.' : 'Connect firm cloud storage to verify root health.');

  const onToggleStrictMode = async (nextValue) => {
    if (nextValue && !config?.isConfigured) {
      setStatusMessage({ type: 'error', text: 'Connect firm storage before enabling strict mode.' });
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

  const onSaveStorageSettingsTab = async (selectedProvider) => {
    setSavingProvider(true);
    try {
      let credentials = {};
      if (selectedProvider === 'onedrive') {
        credentials = { refreshToken: oneDriveRefreshToken, driveId: oneDriveDriveId || null };
      }
      if (selectedProvider === 's3') {
        credentials = {
          bucket: s3Bucket,
          region: s3Region,
          prefix: s3Prefix || '',
          accessKeyId: s3AccessKeyId || undefined,
          secretAccessKey: s3SecretAccessKey || undefined,
          sessionToken: s3SessionToken || undefined,
        };
      }

      await changeStorageProvider({ provider: selectedProvider, verificationToken, credentials });
      setStatusMessage({ type: 'success', text: `Storage provider successfully updated to ${selectedProvider === 's3' ? 'Amazon S3' : 'OneDrive'}.` });
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

  // Restore Handlers
  const onSendRestoreOtp = async () => {
    try {
      await sendStorageChangeOtp(user?.email);
      toast?.showSuccess?.('OTP sent.');
    } catch {
      toast?.showError?.('Unable to send OTP.');
    }
  };

  const onVerifyRestoreOtp = async () => {
    try {
      const result = await verifyStorageChangeOtp(user?.email, restoreOtpCode);
      setRestoreVerificationToken(result?.data?.verificationToken || '');
      toast?.showSuccess?.('OTP verified.');
    } catch {
      toast?.showError?.('OTP verification failed.');
    }
  };

  const onExecuteRestore = async () => {
    setRestoreLoading(true);
    try {
      const payload = {
        verificationToken: restoreVerificationToken,
        ...(restoreSourceMode === 'past_job' ? { exportId: restoreExportId } : { file: restoreFile }),
      };
      const response = await initiateStorageRestore(payload);
      if (response.success && response.jobId) {
        setRestoreJobId(response.jobId);
        setRestoreStatus('started');
        pollRestoreProgress(response.jobId);
      } else {
        throw new Error(response.message || 'Restore initiation failed');
      }
    } catch (error) {
      setRestoreStatus('failed');
      setRestoreErrorMsg(error?.response?.data?.message || error.message || 'Unable to execute restore.');
    } finally {
      setRestoreLoading(false);
    }
  };

  const pollRestoreProgress = (jobId) => {
    const interval = setInterval(async () => {
      try {
        const response = await getStorageRestoreStatus(jobId);
        if (response.success && response.data) {
          const job = response.data;
          setRestoreProgress(job.progress);
          setRestoreStatus(job.status);
          if (job.status === 'completed' || job.status === 'failed') {
            clearInterval(interval);
            if (job.status === 'failed') {
              setRestoreErrorMsg(job.error || 'Decryption or file streaming failed.');
            }
          }
        }
      } catch {
        clearInterval(interval);
        setRestoreStatus('failed');
        setRestoreErrorMsg('Connection lost during status polling.');
      }
    }, 1500);
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
    const confirmed = window.confirm('Disconnect firm storage? Future uploads will revert to Docketra-managed storage.');
    if (!confirmed) return;
    setDisconnecting(true);
    try {
      await disconnectStorage();
      setStatusMessage({ type: 'success', text: 'Firm storage disconnected. Docketra-managed storage is active.' });
      toast?.showSuccess?.('Firm storage disconnected.');
      loadConfiguration();
    } catch (error) {
      const recovery = getRecoveryPayload(error, 'storage_settings');
      setStatusMessage({ type: 'error', text: `${recovery.copy.message} ${recovery.copy.action}` });
      toast?.showError?.('Unable to disconnect firm storage.');
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
        <div className="p-12 flex flex-col items-center justify-center space-y-4">
          <div className="w-12 h-12 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
          <p className="text-slate-500 font-medium animate-pulse">Loading secure configurations...</p>
        </div>
      </PlatformShell>
    );
  }

  return (
    <PlatformShell moduleLabel="Settings" title="Storage settings" subtitle={PAGE_SUBTITLE}>
      <div className="min-h-screen bg-slate-50/50 pb-16 font-sans">
        <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 space-y-8">
          
          {/* Go Back to Settings Link */}
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => navigate(ROUTES.SETTINGS(firmSlug))}
              className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-indigo-600 transition"
            >
              ← Go back to settings
            </button>
          </div>

          <PageHeader title="Storage Settings" subtitle={PAGE_SUBTITLE} />
          
          <StatusMessageStack messages={statusMessages} />

          {/* Premium Overview Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8 space-y-6 transition hover:shadow-md duration-300">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div>
                <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Active Storage Architecture</span>
                <h2 className="text-xl font-bold text-slate-800 mt-1">{currentModeLabel}</h2>
              </div>
              <div className="flex items-center gap-2 self-start md:self-center">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                  statusLabel === 'Active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                  statusLabel === 'Needs attention' ? 'bg-rose-50 text-rose-700 border border-rose-200 animate-pulse' :
                  'bg-slate-50 text-slate-600 border border-slate-200'
                }`}>
                  <span className={`h-2 w-2 rounded-full ${statusLabel === 'Active' ? 'bg-emerald-500' : statusLabel === 'Needs attention' ? 'bg-rose-500' : 'bg-slate-400'}`} />
                  {statusLabel}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm text-slate-600">
              {config?.isConfigured && config?.connectedEmail && (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <span className="text-xs text-slate-400 font-semibold block mb-1">Connected Administrative Account</span>
                  <span className="font-semibold text-slate-700">{config.connectedEmail}</span>
                </div>
              )}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <span className="text-xs text-slate-400 font-semibold block mb-1">Last System Integration Probe</span>
                <span className="font-semibold text-slate-700">
                  {formatDateTime(ownershipSummary?.lastHealthCheck?.checkedAt || config?.updatedAt)}
                </span>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 text-xs leading-relaxed text-slate-500 border border-slate-100 flex items-start gap-2.5">
              <DatabaseIcon className="h-5 w-5 text-indigo-500 flex-shrink-0 mt-0.5" />
              <p>
                <strong>Security Protocol:</strong> Docketra-managed storage isolates tenant data at the storage level. 
                By connecting firm-owned cloud storage, all future binary documents bypass Docketra storage servers completely, 
                retaining data sovereignty and strict operational control entirely under your organization's domain.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              {config?.isConfigured ? (
                <>
                  {normalizedProvider === 'google-drive' && (
                    <Button type="button" variant="primary" onClick={onOpenStorageFolder} disabled={openingFolder || !rootHealthOk}>
                      {openingFolder ? 'Opening Folder…' : 'Open Storage Folder'}
                    </Button>
                  )}
                  <Button type="button" variant="outline" onClick={loadConfiguration} disabled={loading}>Recheck Storage Status</Button>
                  <Button type="button" variant="outline" onClick={onTestConnection} disabled={testing}>{testing ? 'Testing Connection…' : 'Test Credentials'}</Button>
                  <Button type="button" variant="outline" onClick={onDisconnectGoogle} disabled={disconnecting}>{disconnecting ? 'Disconnecting…' : 'Disconnect Storage Connection'}</Button>
                </>
              ) : (
                <div className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-100 text-indigo-800 text-sm font-medium w-full flex items-center justify-between">
                  <span>Reverted to Docketra-managed secure cloud sandbox.</span>
                  <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-bold uppercase">Active Default</span>
                </div>
              )}
            </div>

            {!folderLinkAvailable && normalizedProvider === 'google-drive' && (
              <p className="text-xs text-rose-500 font-medium">⚠️ Connection error: administrative folder link is temporarily unreachable.</p>
            )}
            {rootNeedsAttention && (
              <p className="text-xs text-amber-700 font-semibold">
                Firm storage credentials are connected, but the Google Drive root needs attention: {rootHealthMessage}
              </p>
            )}
            {summaryWarning && <p className="text-xs text-amber-600 font-medium">{summaryWarning}</p>}
          </div>

          {/* Elevated Provider Switcher Suite */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8 space-y-6 transition hover:shadow-md duration-300">
            <div>
              <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Connection Command Center</span>
              <h2 className="text-xl font-bold text-slate-800 mt-1">Configure Provider Settings</h2>
              <p className="text-slate-500 text-sm mt-1">Elevate OneDrive and S3 as first-class adapters, or link Google Drive directly in your dashboard.</p>
            </div>

            {/* Premium Three-Way Card Tab System */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                type="button"
                className={`flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all duration-300 text-center ${
                  providerTab === 'google-drive'
                    ? 'border-indigo-600 bg-indigo-50/30 shadow-sm'
                    : 'border-slate-100 bg-slate-50/30 hover:border-slate-200 hover:bg-slate-50/60'
                }`}
                onClick={() => setProviderTab('google-drive')}
              >
                <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-100 mb-3">
                  <GoogleDriveIcon className="h-8 w-8" />
                </div>
                <h3 className="font-bold text-slate-800 text-sm">Google Drive</h3>
                <span className="text-xs text-slate-400 mt-1 block">OAuth 2.0 Direct Link</span>
                {normalizedProvider === 'google-drive' && config?.isConfigured && (
                  <span className="mt-2 text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold uppercase rounded-full">Currently Active</span>
                )}
              </button>

              <button
                type="button"
                className={`flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all duration-300 text-center ${
                  providerTab === 'onedrive'
                    ? 'border-indigo-600 bg-indigo-50/30 shadow-sm'
                    : 'border-slate-100 bg-slate-50/30 hover:border-slate-200 hover:bg-slate-50/60'
                }`}
                onClick={() => setProviderTab('onedrive')}
              >
                <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-100 mb-3">
                  <OneDriveIcon className="h-8 w-8" />
                </div>
                <h3 className="font-bold text-slate-800 text-sm">Microsoft OneDrive</h3>
                <span className="text-xs text-slate-400 mt-1 block">Graph API Token Rotation</span>
                {currentProvider === 'onedrive' && config?.isConfigured && (
                  <span className="mt-2 text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold uppercase rounded-full">Currently Active</span>
                )}
              </button>

              <button
                type="button"
                className={`flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all duration-300 text-center ${
                  providerTab === 's3'
                    ? 'border-indigo-600 bg-indigo-50/30 shadow-sm'
                    : 'border-slate-100 bg-slate-50/30 hover:border-slate-200 hover:bg-slate-50/60'
                }`}
                onClick={() => setProviderTab('s3')}
              >
                <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-100 mb-3">
                  <S3Icon className="h-8 w-8" />
                </div>
                <h3 className="font-bold text-slate-800 text-sm">Amazon AWS S3</h3>
                <span className="text-xs text-slate-400 mt-1 block">IAM Secured Bucket Mode</span>
                {currentProvider === 's3' && config?.isConfigured && (
                  <span className="mt-2 text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold uppercase rounded-full">Currently Active</span>
                )}
              </button>
            </div>

            {/* Tab Panels */}
            <div className="border-t border-slate-100 pt-6">
              {providerTab === 'google-drive' && (
                <div className="space-y-4 max-w-lg">
                  <h4 className="font-bold text-slate-800">Configure Google Drive Connection</h4>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    Link your firm's G Suite or Google Drive securely. Docketra will create a dedicated parent folder 
                    and manifest mappings using minimum-scope metadata permissions.
                  </p>
                  
                  {isGoogleConnected ? (
                    <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-100 space-y-3">
                      <div className="flex items-center gap-2 text-emerald-800">
                        <span className="h-5 w-5 bg-emerald-100 rounded-full flex items-center justify-center text-xs font-bold">✓</span>
                        <span className="font-bold text-sm">Active Google Drive Connected</span>
                      </div>
                      <p className="text-xs text-emerald-600">Connected account domain: {config?.connectedEmail || 'N/A'}</p>
                      <div className="flex gap-2 pt-1">
                        <Button type="button" variant="primary" onClick={connectGoogleDrive}>Reconnect Account</Button>
                        <Button type="button" variant="outline" onClick={onDisconnectGoogle} disabled={disconnecting}>{disconnecting ? 'Disconnecting…' : 'Disconnect Connection'}</Button>
                      </div>
                    </div>
                  ) : (
                    <Button type="button" variant="primary" onClick={connectGoogleDrive}>Connect Firm Google Drive</Button>
                  )}
                </div>
              )}

              {providerTab === 'onedrive' && (
                <div className="space-y-5">
                  <h4 className="font-bold text-slate-800">Configure Microsoft OneDrive</h4>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    Connect your Microsoft 365 Business OneDrive. Token rotations will guarantee connection longevity.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="OneDrive Refresh Token" placeholder="Enter secure refresh token" value={oneDriveRefreshToken} onChange={(event) => setOneDriveRefreshToken(event.target.value)} />
                    <Input label="OneDrive Drive ID (optional)" placeholder="e.g. b!1234abcd-..." value={oneDriveDriveId} onChange={(event) => setOneDriveDriveId(event.target.value)} />
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-4">
                    <div className="flex items-center gap-2 text-slate-800">
                      <ShieldIcon className="h-5 w-5 text-indigo-600" />
                      <h4 className="font-bold text-sm">Step-up Administrative Authentication</h4>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Saving storage change adaptions requires confirming your administrative identity via temporary OTP verification.
                    </p>
                    
                    <div className="flex flex-col sm:flex-row gap-3 items-end max-w-lg">
                      <div className="flex-1 w-full">
                        <Input label="Verification OTP Code" placeholder="Enter 6-digit code" value={otpCode} onChange={(event) => setOtpCode(event.target.value)} />
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <Button type="button" variant="outline" onClick={onSendOtp}>Send OTP</Button>
                        <Button type="button" variant="outline" onClick={onVerifyOtp}>Verify OTP</Button>
                      </div>
                    </div>

                    <Button type="button" variant="primary" onClick={() => onSaveStorageSettingsTab('onedrive')} disabled={!verificationToken || savingProvider}>
                      {savingProvider ? 'Saving Configuration…' : 'Activate Microsoft OneDrive'}
                    </Button>
                  </div>
                </div>
              )}

              {providerTab === 's3' && (
                <div className="space-y-5">
                  <h4 className="font-bold text-slate-800">Configure Amazon AWS S3</h4>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    Enter AWS IAM access keys with strict permission boundaries. Ensure the bucket has CORS configured.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input label="S3 Bucket Name" placeholder="e.g. docketra-firm-vault" value={s3Bucket} onChange={(event) => setS3Bucket(event.target.value)} />
                    <Input label="S3 Region" placeholder="e.g. us-east-1" value={s3Region} onChange={(event) => setS3Region(event.target.value)} />
                    <Input label="S3 Key Prefix (optional)" placeholder="e.g. documents/" value={s3Prefix} onChange={(event) => setS3Prefix(event.target.value)} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input label="AWS Access Key ID" placeholder="AKIA..." value={s3AccessKeyId} onChange={(event) => setS3AccessKeyId(event.target.value)} />
                    <Input label="AWS Secret Access Key" placeholder="••••••••••••" type="password" value={s3SecretAccessKey} onChange={(event) => setS3SecretAccessKey(event.target.value)} />
                    <Input label="AWS Session Token (optional)" placeholder="Session token if using roles" value={s3SessionToken} onChange={(event) => setS3SessionToken(event.target.value)} />
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-4">
                    <div className="flex items-center gap-2 text-slate-800">
                      <ShieldIcon className="h-5 w-5 text-indigo-600" />
                      <h4 className="font-bold text-sm">Step-up Administrative Authentication</h4>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Saving storage change adaptions requires confirming your administrative identity via temporary OTP verification.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-3 items-end max-w-lg">
                      <div className="flex-1 w-full">
                        <Input label="Verification OTP Code" placeholder="Enter 6-digit code" value={otpCode} onChange={(event) => setOtpCode(event.target.value)} />
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <Button type="button" variant="outline" onClick={onSendOtp}>Send OTP</Button>
                        <Button type="button" variant="outline" onClick={onVerifyOtp}>Verify OTP</Button>
                      </div>
                    </div>

                    <Button type="button" variant="primary" onClick={() => onSaveStorageSettingsTab('s3')} disabled={!verificationToken || savingProvider}>
                      {savingProvider ? 'Activating AWS S3…' : 'Activate Amazon S3'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Root Health Warnings */}
          {normalizedProvider === 'google-drive' && (
            <div className={`p-5 rounded-2xl border flex items-start gap-3 transition-all ${
              rootHealthOk ? 'bg-emerald-50/50 border-emerald-100 text-emerald-800' : 'bg-amber-50/50 border-amber-100 text-amber-800'
            }`}>
              <span className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${rootHealthOk ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                {rootHealthOk ? '✓' : '!'}
              </span>
              <div className="space-y-1">
                <h4 className="font-bold text-sm">Google Drive storage root health</h4>
                <p className="text-xs opacity-90 leading-relaxed">{rootHealthMessage}</p>
                {strictFirmOwnedStorage && !rootHealthOk && (
                  <p className="text-xs text-rose-700 font-semibold mt-1">
                    ⚠️ CRITICAL: Strict Mode is active. Business-content writes are currently blocked until Google Drive storage is fully recovered.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Strict Mode Module */}
          {user?.role === 'PRIMARY_ADMIN' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8 space-y-4 transition hover:shadow-md duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1 max-w-xl">
                  <h3 className="font-bold text-slate-800">Strict Firm-Owned Storage Enforcement</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    By enabling strict mode, you enforce a zero-fallback policy. Writes are blocked if your firm's cloud storage goes offline, 
                    preventing any document metadata from falling back to Docketra-managed default storage sandboxes.
                  </p>
                </div>
                <div>
                  <Button
                    type="button"
                    variant={strictFirmOwnedStorage ? 'outline' : 'primary'}
                    onClick={() => onToggleStrictMode(!strictFirmOwnedStorage)}
                    disabled={strictModeSaving || (!config?.isConfigured && !strictFirmOwnedStorage)}
                  >
                    {strictModeSaving ? 'Updating...' : strictFirmOwnedStorage ? 'Disable Strict Mode' : 'Enable Strict Mode'}
                  </Button>
                </div>
              </div>
              {!config?.isConfigured && (
                <p className="text-xs text-amber-600 font-semibold">⚠️ Connect your firm cloud storage adapter first before activating strict enforcement.</p>
              )}
            </div>
          )}

          {/* Storage Capacity Progress tracker */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8 space-y-5 transition hover:shadow-md duration-300">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Space Allocation</span>
                <h3 className="font-bold text-slate-800 text-lg mt-0.5">Storage Capacity</h3>
              </div>
              <Button type="button" variant="outline" onClick={loadStorageUsage} disabled={usageLoading}>
                {usageLoading ? 'Refreshing…' : 'Refresh Space'}
              </Button>
            </div>

            {usageLoading ? (
              <div className="py-6 flex items-center justify-center space-x-2">
                <div className="w-5 h-5 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
                <span className="text-sm text-slate-500 font-medium">Resolving storage quotas...</span>
              </div>
            ) : usage?.managedFallback ? (
              <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 text-indigo-900 text-sm leading-relaxed">
                🚀 Docketra-managed high-performance default cloud sandbox is active. Space capacity and bandwidth quotas are fully optimized and managed by Docketra automatically.
              </div>
            ) : usage?.quotaAvailable ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center sm:text-left">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <span className="text-xs text-slate-400 font-semibold block mb-1">Space Used</span>
                    <span className="font-bold text-slate-800 text-lg">{usage.displayUsed}</span>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <span className="text-xs text-slate-400 font-semibold block mb-1">Space Available</span>
                    <span className="font-bold text-slate-800 text-lg">{usage.displayAvailable}</span>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <span className="text-xs text-slate-400 font-semibold block mb-1">Total Capacity</span>
                    <span className="font-bold text-slate-800 text-lg">{usage.displayTotal}</span>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <span className="text-xs text-slate-400 font-semibold block mb-1">Fill Rate</span>
                    <span className="font-bold text-slate-800 text-lg">{Math.round(usagePercent)}%</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden border border-slate-200/50">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        usagePercent >= 90 ? 'bg-gradient-to-r from-rose-500 to-rose-600' :
                        usagePercent >= 75 ? 'bg-gradient-to-r from-amber-500 to-amber-600' :
                        'bg-gradient-to-r from-emerald-500 to-indigo-600'
                      }`}
                      style={{ width: `${Math.max(0, Math.min(100, usagePercent))}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 px-1">
                    <span>0% Filled</span>
                    <span>100% Filled</span>
                  </div>
                </div>

                {usagePercent >= 95 && <p className="text-xs text-rose-600 font-semibold">⚠️ Critical: Your storage is almost full. Subsequent file uploads might fail.</p>}
                {usagePercent >= 85 && usagePercent < 95 && <p className="text-xs text-amber-600 font-medium">⚠️ Warning: Storage is highly utilized. Consider cleaning up or upgrading capacity soon.</p>}
                
                <p className="text-[10px] text-slate-400">Capacity metric computed at: {formatDateTime(usage.lastCheckedAt)}</p>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-slate-500 text-sm">
                Quotas and capacities are not exposed via your connected account type. Health and active status are verified.
              </div>
            )}
            {usageError && <p className="text-xs text-rose-500 font-medium">{usageError}</p>}
          </div>

          {/* Technical Data Storage Map */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8 space-y-5 transition hover:shadow-md duration-300">
            <div>
              <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Architectural Schema</span>
              <h3 className="font-bold text-slate-800 text-lg mt-0.5">Control-Plane Data Mapping</h3>
              <p className="text-slate-500 text-sm mt-1">Review the logical allocation mapping between MongoDB control records and your cloud binaries.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm font-medium">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-slate-700">
                <span className="text-xs text-slate-400 font-bold block mb-1">Client Profiles</span>
                <span>→ firm cloud profile.json</span>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-slate-700">
                <span className="text-xs text-slate-400 font-bold block mb-1">Attachments & CFS</span>
                <span>→ cloud folders/files</span>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-slate-700">
                <span className="text-xs text-slate-400 font-bold block mb-1">Database Layer</span>
                <span>→ MongoDB metadata</span>
              </div>
            </div>

            <details className="group bg-slate-50/50 rounded-2xl border border-slate-100 overflow-hidden">
              <summary className="flex justify-between items-center p-4 cursor-pointer font-bold text-slate-800 text-sm select-none list-none">
                <span>View Technical Storage Paths & Mappings</span>
                <span className="transition duration-300 group-open:rotate-180 text-xs">▼</span>
              </summary>
              <div className="p-4 border-t border-slate-100 space-y-4 text-xs text-slate-600 bg-white">
                <div className="space-y-1.5">
                  <h4 className="font-bold text-slate-800">Active Directory Paths</h4>
                  <ul className="list-disc pl-5 space-y-1">
                    {(ownershipSummary?.dataStorageMap?.googleDriveFolderPaths || []).map((item) => (
                      <li key={item.key}><strong className="text-slate-700">{item.key}:</strong> <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-700 font-semibold">{item.path}</code></li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-1.5">
                  <h4 className="font-bold text-slate-800">MongoDB Control-Plane Metadata Categories</h4>
                  <ul className="list-disc pl-5 space-y-1">
                    {(ownershipSummary?.dataStorageMap?.mongoControlPlaneMetadata || []).map((item) => (
                      <li key={item}><code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-700 font-semibold">{item}</code></li>
                    ))}
                  </ul>
                </div>
              </div>
            </details>

            <Link className="inline-flex items-center text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition" to={ROUTES.DATA_STORAGE_MAP(config?.firmSlug || user?.firmSlug || '')}>
              Open Graphical Storage Schema Map →
            </Link>
          </div>

          {/* Backup & Disaster Recovery Card */}
          <div className="bg-slate-900 text-white rounded-3xl shadow-xl p-6 md:p-8 space-y-6 relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -ml-16 -mb-16 pointer-events-none" />

            <div className="space-y-2 relative">
              <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20 inline-block">Enterprise Resilience Suite</span>
              <h3 className="font-extrabold text-2xl tracking-tight">Disaster Recovery & Nightly Backups</h3>
              <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
                Nightly backups package all system directories into secure AES-256-GCM encrypted ZIP archives. 
                In case of administrative workspace failures, you can seamlessly deploy recovery restorations.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 pt-2 relative">
              <Button 
                type="button" 
                variant="primary" 
                allowUnsafeClassName={true}
                className="!bg-indigo-600 hover:!bg-indigo-700 !border-none !text-white font-bold" 
                onClick={onGenerateExport} 
                disabled={exporting}
              >
                {exporting ? 'Generating Vault Backup…' : 'Backup Storage Now'}
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                allowUnsafeClassName={true}
                className="!border-slate-700 !text-slate-200 hover:!bg-slate-800 hover:!text-white font-semibold transition-all duration-200" 
                onClick={() => setShowRestoreModal(true)}
              >
                Open Restore Wizard
              </Button>
            </div>

            {exportWarning && <p className="text-xs text-rose-400 font-medium relative">⚠️ {exportWarning}</p>}
          </div>
        </div>
      </div>

      {/* Modern Glassmorphic Restore Wizard Modal */}
      {showRestoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Storage Restore Wizard</h2>
                <p className="text-xs text-slate-500">Secure AES-256-GCM Decrypter Engine</p>
              </div>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-600 text-2xl font-semibold h-8 w-8 rounded-full hover:bg-slate-100 flex items-center justify-center transition"
                onClick={() => {
                  if (restoreLoading) return;
                  setShowRestoreModal(false);
                  setRestoreProgress(0);
                  setRestoreStatus('');
                  setRestoreJobId('');
                  setRestoreFile(null);
                  setRestoreExportId('');
                  setRestoreOtpCode('');
                  setRestoreVerificationToken('');
                }}
              >
                ×
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {restoreStatus === 'completed' ? (
                <div className="space-y-5 text-center py-6">
                  <div className="h-16 w-16 rounded-full bg-emerald-50 border-2 border-emerald-400 text-emerald-600 flex items-center justify-center mx-auto text-3xl font-extrabold animate-bounce">✓</div>
                  <div className="space-y-2">
                    <h3 className="font-extrabold text-xl text-slate-800">Restoration Completed Successfully</h3>
                    <p className="text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
                      All files have been decrypted, verified for checksum parity, and re-uploaded back into your active cloud storage bucket. Mappings are fully recovered!
                    </p>
                  </div>
                  <Button type="button" variant="primary" fullWidth className="py-3 font-bold" onClick={() => {
                    setShowRestoreModal(false);
                    loadConfiguration();
                  }}>
                    Done
                  </Button>
                </div>
              ) : restoreStatus === 'failed' ? (
                <div className="space-y-5 text-center py-6">
                  <div className="h-16 w-16 rounded-full bg-rose-50 border-2 border-rose-400 text-rose-600 flex items-center justify-center mx-auto text-3xl font-extrabold animate-pulse">!</div>
                  <div className="space-y-2">
                    <h3 className="font-extrabold text-xl text-rose-600">Restoration Failed</h3>
                    <p className="text-sm text-rose-700/80 bg-rose-50 p-3 rounded-2xl max-w-sm mx-auto text-xs leading-relaxed font-semibold border border-rose-100">
                      {restoreErrorMsg || 'Unable to complete stream decrypt or re-upload.'}
                    </p>
                  </div>
                  <Button type="button" variant="primary" fullWidth className="py-3 font-bold" onClick={() => {
                    setRestoreStatus('');
                    setRestoreProgress(0);
                  }}>
                    Configure and Try Again
                  </Button>
                </div>
              ) : restoreJobId ? (
                <div className="space-y-5 py-6 text-center">
                  <div className="flex justify-between items-center text-sm font-semibold text-slate-700 px-1">
                    <span>Active Decryption Stream Upload: <span className="capitalize text-indigo-600 font-bold">{restoreStatus || 'Processing...'}</span></span>
                    <span>{restoreProgress}%</span>
                  </div>
                  
                  {/* Custom animated progress tracks */}
                  <div className="h-3.5 w-full rounded-full bg-slate-100 overflow-hidden border border-slate-200/50 p-0.5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 transition-all duration-300"
                      style={{ width: `${restoreProgress}%` }}
                    />
                  </div>

                  <p className="text-xs text-slate-400 max-w-xs mx-auto animate-pulse leading-relaxed">
                    Docketra decrypters are streaming raw decrypted streams directly back to active bucket endpoints. Do not navigate away from this page.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  <p className="text-xs text-slate-500 leading-relaxed bg-indigo-50 p-3 rounded-xl border border-indigo-100 font-medium">
                    🔑 <strong>Security Step-Up Policy:</strong> Disaster recovery requires dynamic verification. Confirm your primary admin identity below.
                  </p>
                  
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">1. Verification Step-up</h3>
                    <div className="flex flex-col sm:flex-row gap-3 items-end">
                      <div className="flex-1 w-full">
                        <Input label="OTP Verification Code" placeholder="Enter code" value={restoreOtpCode} onChange={(event) => setRestoreOtpCode(event.target.value)} />
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <Button type="button" variant="outline" onClick={onSendRestoreOtp}>Send</Button>
                        <Button type="button" variant="outline" onClick={onVerifyRestoreOtp}>Verify</Button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">2. Select Recovery Source</h3>
                    
                    <Select
                      label="Select Mode"
                      value={restoreSourceMode}
                      onChange={(e) => setRestoreSourceMode(e.target.value)}
                      options={[
                        { value: 'past_job', label: 'Past completed backup Job ID' },
                        { value: 'file_upload', label: 'Upload local encrypted .zip.enc file' }
                      ]}
                    />
                    
                    {restoreSourceMode === 'past_job' ? (
                      <Input
                        label="Backup Job UUID"
                        placeholder="e.g. 5767585d-379d-7b6d-e6c9-3689ab447123"
                        value={restoreExportId}
                        onChange={(e) => setRestoreExportId(e.target.value)}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 rounded-2xl hover:bg-slate-50/50 hover:border-indigo-500 transition-all cursor-pointer relative group">
                        <input
                          type="file"
                          accept=".zip,.enc,.zip.enc"
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                              setRestoreFile(e.target.files[0]);
                            }
                          }}
                        />
                        <div className="text-center space-y-2">
                          <span className="text-3xl font-extrabold text-slate-400 group-hover:text-indigo-500 transition block mb-1">↑</span>
                          <p className="text-sm font-bold text-slate-600">
                            {restoreFile ? `Selected: ${restoreFile.name}` : 'Click or Drag & Drop Backup here'}
                          </p>
                          <p className="text-xs text-slate-400">Encrypted .zip.enc packages up to 50MB</p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="pt-2">
                    <Button
                      type="button"
                      variant="primary"
                      fullWidth
                      className="py-3 font-bold"
                      disabled={!restoreVerificationToken || (restoreSourceMode === 'past_job' ? !restoreExportId : !restoreFile) || restoreLoading}
                      onClick={onExecuteRestore}
                    >
                      {restoreLoading ? 'Decrypting Stream...' : 'Run Symmetrical Decryption Recovery'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </PlatformShell>
  );
}

export default StorageSettingsPage;
