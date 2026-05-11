import React, { useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
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
  sendStorageChangeOtp,
  testStorageConnection,
  disconnectStorage,
  verifyStorageChangeOtp,
  exportFirmStorage,
  listStorageExports,
} from '../services/storageService';
import { useAuth } from '../hooks/useAuth';
import { spacingClasses } from '../theme/tokens';
import { PageHeader } from '../components/layout/PageHeader';
import { formatDateTime } from '../utils/formatDateTime';
import { getRecoveryPayload } from '../utils/errorRecovery';
import { SupportContext } from '../components/feedback/SupportContext';
import { StatusMessageStack } from './platform/PlatformShared';

const PAGE_SUBTITLE = 'Docketra-managed storage works by default. You can optionally connect your firm’s own Google Drive.';

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

  const loadConfiguration = async () => {
    setLoading(true);
    setLoadError('');
    setSummaryWarning('');
    setExportWarning('');

    try {
      const data = await getStorageConfiguration();
      setConfig(data);

      const [summaryResult, exportsResult] = await Promise.allSettled([
        getStorageOwnershipSummary(),
        listStorageExports(10),
      ]);

      if (summaryResult.status === 'fulfilled') {
        setOwnershipSummary(summaryResult.value);
      } else {
        setOwnershipSummary(null);
        setSummaryWarning('Storage ownership summary is temporarily unavailable.');
      }

      if (exportsResult.status !== 'fulfilled') {
        setExportWarning('Export history is temporarily unavailable.');
      }
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
  const currentModeLabel = isGoogleConnected ? 'Firm-owned Google Drive' : 'Docketra-managed storage';
  const statusLabel = config?.status?.includes('ERROR') || config?.status?.includes('DISCONNECTED')
    ? 'Error / disconnected'
    : config?.isConfigured ? 'Active' : 'Not connected';

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
      await loadConfiguration();
    } catch (error) {
      const recovery = getRecoveryPayload(error, 'storage_settings');
      setStatusMessage({ type: 'error', text: `${recovery.copy.message} ${recovery.copy.action}` });
    } finally {
      setExporting(false);
    }
  };

  const statusMessages = [
    loadError ? { tone: 'error', message: loadError } : null,
    statusMessage.text
      ? { tone: statusMessage.type === 'error' ? 'error' : 'success', message: statusMessage.text }
      : null,
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

          <Card>
            <div className={spacingClasses.sectionMargin}>
              <h2 className="text-lg font-medium">Current storage</h2>
              <p>Current mode: {currentModeLabel}</p>
              <p>Status: {statusLabel}</p>
              {isGoogleConnected ? <p>Connected email: {config?.connectedEmail || 'N/A'}</p> : null}
              <p>Last checked: {formatDateTime(ownershipSummary?.lastHealthCheck?.checkedAt || config?.updatedAt)}</p>
              <p className="text-sm text-[var(--dt-text-muted)]">
                Your team can upload files even without BYOS. Files are stored in Docketra-managed Google Drive unless firm-owned storage is connected.
              </p>
              {summaryWarning ? <p className="text-sm text-[var(--dt-warning)]">{summaryWarning}</p> : null}
            </div>
          </Card>

          <Card>
            <div className={spacingClasses.sectionMargin}>
              <h2 className="text-lg font-medium">Default storage</h2>
              <p className="font-medium">Default: Docketra-managed Google Drive</p>
              <p>Status: {ownershipSummary?.fallbackStorage?.status || ownershipSummary?.managedFallback?.status || 'Active'}</p>
              <p className="text-sm text-[var(--dt-text-muted)]">No setup is required from your firm.</p>
            </div>
          </Card>

          <Card>
            <div className={spacingClasses.sectionMargin}>
              <h2 className="text-lg font-medium">Firm-owned Google Drive (optional)</h2>
              {!isGoogleConnected ? (
                <>
                  <p className="text-sm">
                    You’ll be redirected to Google to approve Drive access. After approval, Docketra will store future uploads in your firm-owned Drive.
                  </p>
                  <Button type="button" variant="primary" onClick={connectGoogleDrive}>Connect firm Google Drive</Button>
                </>
              ) : (
                <>
                  <p>Connected email: {config?.connectedEmail || 'N/A'}</p>
                  <div className="flex gap-3">
                    <Button type="button" variant="primary" onClick={connectGoogleDrive}>Refresh Google Drive connection</Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onTestConnection}
                      disabled={testing}
                    >
                      {testing ? 'Testing...' : 'Test connection'}
                    </Button>
                                      <Button type="button" variant="outline" onClick={onDisconnectGoogle} disabled={disconnecting}>
                      {disconnecting ? 'Disconnecting...' : 'Disconnect firm Google Drive'}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </Card>

          <Card>
            <div className={spacingClasses.sectionMargin}>
              <details>
                <summary className="cursor-pointer font-medium">Advanced manual storage providers</summary>
                <p className="text-sm mt-2">Not recommended for normal setup. Use only if support has instructed you.</p>
                <SupportContext context={supportContext} />
                <div className="mt-3">
                  <Select
                    label="Manual provider"
                    value={provider}
                    onChange={(event) => setProvider(event.target.value)}
                    options={[
                      { value: 'onedrive', label: 'Microsoft OneDrive — manual setup only' },
                      { value: 's3', label: 'Amazon S3 — advanced setup' },
                    ]}
                  />

                  {provider === 'onedrive' ? (
                    <>
                      <Input label="OneDrive Refresh Token" value={oneDriveRefreshToken} onChange={(event) => setOneDriveRefreshToken(event.target.value)} />
                      <Input label="OneDrive Drive ID (optional)" value={oneDriveDriveId} onChange={(event) => setOneDriveDriveId(event.target.value)} />
                    </>
                  ) : null}

                  {provider === 's3' ? (
                    <>
                      <Input label="S3 Bucket" value={s3Bucket} onChange={(event) => setS3Bucket(event.target.value)} />
                      <Input label="S3 Region" value={s3Region} onChange={(event) => setS3Region(event.target.value)} />
                      <Input label="S3 Prefix (optional)" value={s3Prefix} onChange={(event) => setS3Prefix(event.target.value)} />
                      <Input label="S3 Access Key ID (optional)" value={s3AccessKeyId} onChange={(event) => setS3AccessKeyId(event.target.value)} />
                      <Input label="S3 Secret Access Key (optional)" value={s3SecretAccessKey} onChange={(event) => setS3SecretAccessKey(event.target.value)} />
                      <Input label="S3 Session Token (optional)" value={s3SessionToken} onChange={(event) => setS3SessionToken(event.target.value)} />
                    </>
                  ) : null}

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3 items-end">
                    <Input label="OTP Code" value={otpCode} onChange={(event) => setOtpCode(event.target.value)} />
                    <Button type="button" variant="outline" onClick={onSendOtp}>Send OTP</Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onVerifyOtp}
                    >
                      Verify OTP
                    </Button>
                  </div>

                  <Button type="button" variant="primary" onClick={onSaveStorageSettings} disabled={!verificationToken || savingProvider}>
                    {savingProvider ? 'Saving…' : 'Save Provider'}
                  </Button>
                </div>
              </details>
            </div>
          </Card>

          <Card>
            <div className={spacingClasses.sectionMargin}>
              <h2 className="text-lg font-medium">Backup / export</h2>
              <p className="text-sm">Export generates a backup of firm storage metadata/files where supported.</p>
              <Button
                type="button"
                variant="primary"
                onClick={onGenerateExport}
                disabled={exporting}
              >
                {exporting ? 'Generating Export…' : 'Generate Firm Export'}
              </Button>
              {exportWarning ? <p className="text-sm text-[var(--dt-warning)]">{exportWarning}</p> : null}
            </div>
          </Card>
        </div>
      </div>
    </PlatformShell>
  );
}

export default StorageSettingsPage;
