import React, { useContext, useEffect, useState } from 'react';
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

export function StorageSettingsPage() {
  const toast = useContext(ToastContext);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [savingProvider, setSavingProvider] = useState(false);
  const [provider, setProvider] = useState('docketra_managed');
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
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });
  const [supportContext, setSupportContext] = useState(null);
  const [exportRuns, setExportRuns] = useState([]);
  const [exportsLoading, setExportsLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [ownershipSummary, setOwnershipSummary] = useState(null);
  const { user } = useAuth();

  const loadConfiguration = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await getStorageConfiguration();
      setConfig(data);
      const summary = await getStorageOwnershipSummary();
      setOwnershipSummary(summary);
      const exportData = await listStorageExports(10);
      setExportRuns(Array.isArray(exportData?.data) ? exportData.data : []);
    } catch (error) {
      const recovery = getRecoveryPayload(error, 'storage_settings');
      setLoadError(`${recovery.copy.message} ${recovery.copy.action}`);
      setSupportContext(recovery.supportContext);
      toast?.showError?.(recovery.copy.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfiguration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (config?.provider) {
      setProvider(config.provider);
    }
  }, [config]);

  const onConnectGoogleDrive = () => {
    connectGoogleDrive();
  };

  const onTestConnection = async () => {
    setTesting(true);
    setStatusMessage({ type: 'info', text: 'Testing storage connection…' });
    try {
      const result = await testStorageConnection();
      toast?.showSuccess?.(result?.message || 'Storage connection is healthy.');
      setStatusMessage({ type: 'success', text: result?.message || 'Storage connection is healthy.' });
      await loadConfiguration();
    } catch (error) {
      const recovery = getRecoveryPayload(error, 'storage_settings');
      setStatusMessage({ type: 'error', text: `${recovery.copy.message} ${recovery.copy.action}` });
      setSupportContext(recovery.supportContext);
      toast?.showError?.(recovery.copy.message);
    } finally {
      setTesting(false);
    }
  };

  const requestOtp = async () => {
    try {
      await sendStorageChangeOtp(user?.email);
      toast?.showSuccess?.('OTP sent to your email.');
    } catch (error) {
      toast?.showError?.(error?.response?.data?.message || 'Unable to send OTP');
    }
  };

  const verifyOtp = async () => {
    try {
      const result = await verifyStorageChangeOtp(user?.email, otpCode);
      setVerificationToken(result?.data?.verificationToken || '');
      toast?.showSuccess?.('OTP verified.');
    } catch (error) {
      toast?.showError?.(error?.response?.data?.message || 'OTP verification failed');
    }
  };

  const onSaveStorageSettings = async () => {
    setSavingProvider(true);
    setStatusMessage({ type: 'info', text: 'Saving storage provider settings…' });
    try {
      let credentials = {};
      if (provider === 'onedrive') {
        credentials = {
          refreshToken: oneDriveRefreshToken,
          driveId: oneDriveDriveId || null,
        };
      } else if (provider === 's3') {
        credentials = {
          bucket: s3Bucket,
          region: s3Region,
          prefix: s3Prefix || '',
          accessKeyId: s3AccessKeyId || undefined,
          secretAccessKey: s3SecretAccessKey || undefined,
          sessionToken: s3SessionToken || undefined,
        };
      }

      await changeStorageProvider({
        provider,
        verificationToken,
        credentials,
      });
      toast?.showSuccess?.('Storage settings updated.');
      setStatusMessage({ type: 'success', text: 'Storage settings updated.' });
      await loadConfiguration();
    } catch (error) {
      const recovery = getRecoveryPayload(error, 'storage_settings');
      setStatusMessage({ type: 'error', text: `${recovery.copy.message} ${recovery.copy.action}` });
      setSupportContext(recovery.supportContext);
      toast?.showError?.(recovery.copy.message);
    } finally {
      setSavingProvider(false);
    }
  };

  const onRunExport = async () => {
    setExporting(true);
    setStatusMessage({ type: 'info', text: 'Generating export archive…' });
    try {
      const result = await exportFirmStorage();
      setStatusMessage({
        type: 'success',
        text: result?.downloadUrl
          ? 'Export generated. Use the download link or export history below.'
          : 'Export generated. Download link may be provider-limited; use export history and support recovery guidance.',
      });
      await loadConfiguration();
    } catch (error) {
      const recovery = getRecoveryPayload(error, 'storage_export');
      setStatusMessage({ type: 'error', text: `${recovery.copy.message} ${recovery.copy.action}` });
      setSupportContext(recovery.supportContext);
      toast?.showError?.(recovery.copy.message);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <PlatformShell moduleLabel="Settings" title="Storage settings" subtitle="Configure and validate your external document storage integration.">
        <div className="min-h-screen w-full flex-1 bg-[var(--dt-bg-warm)]">
          <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 space-y-6">
            <PageHeader title="Storage Settings" subtitle="Configure and validate your external document storage integration." />
            <Card>
              <p className="text-sm text-[var(--dt-text-muted)]">Loading storage settings...</p>
            </Card>
          </div>
        </div>
      </PlatformShell>
    );
  }

  const connected = config?.isConfigured;
  const storageMode = provider === 'docketra_managed' ? 'Docketra-managed storage' : 'Firm-connected storage';
  const isGoogleProvider = provider === 'google-drive';
  const isOneDriveProvider = provider === 'onedrive';
  const isS3Provider = provider === 's3';
  const canSwitchProvider = provider !== (config?.provider || 'docketra_managed');
  const summaryWarnings = Array.isArray(ownershipSummary?.warnings) ? ownershipSummary.warnings : [];
  const statusMessages = [
    loadError ? { tone: 'error', message: loadError } : null,
    statusMessage.text
      ? {
        tone: statusMessage.type === 'error' ? 'error' : statusMessage.type === 'success' ? 'success' : 'info',
        message: statusMessage.text,
      }
      : null,
  ].filter(Boolean);

  return (
    <PlatformShell moduleLabel="Settings" title="Storage settings" subtitle="Configure and validate your external document storage integration.">
      <div className="min-h-screen bg-[var(--dt-bg-warm)]">
        <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 space-y-6">
          <PageHeader title="Storage Settings" subtitle="Configure and validate your external document storage integration." />

          <StatusMessageStack messages={statusMessages} />

          <Card>
            <div className={spacingClasses.sectionMargin}>
              <div>
                <h2 className="text-lg font-medium text-[var(--dt-text)] mb-2">Storage & Data Ownership</h2>
                <p className="text-sm text-[var(--dt-text-secondary)]">
                  Docketra acts as a control plane. Firm/client data should stay in your configured storage provider based on your data ownership model.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="rounded border border-[var(--dt-border-whisper)] bg-[var(--dt-surface)] px-3 py-2">
                  <p className="font-medium text-[var(--dt-text)]">Active provider</p>
                  <p className="text-[var(--dt-text-secondary)]">{ownershipSummary?.activeStorage?.provider || provider}</p>
                </div>
                <div className="rounded border border-[var(--dt-border-whisper)] bg-[var(--dt-surface)] px-3 py-2">
                  <p className="font-medium text-[var(--dt-text)]">Connection status</p>
                  <p className="text-[var(--dt-text-secondary)]">{ownershipSummary?.activeStorage?.connectionStatus || 'UNKNOWN'}</p>
                </div>
                <div className="rounded border border-[var(--dt-border-whisper)] bg-[var(--dt-surface)] px-3 py-2">
                  <p className="font-medium text-[var(--dt-text)]">Last health check</p>
                  <p className="text-[var(--dt-text-secondary)]">{formatDateTime(ownershipSummary?.lastHealthCheck?.checkedAt)}</p>
                </div>
                <div className="rounded border border-[var(--dt-border-whisper)] bg-[var(--dt-surface)] px-3 py-2">
                  <p className="font-medium text-[var(--dt-text)]">Fallback storage</p>
                  <p className="text-[var(--dt-text-secondary)]">
                    {ownershipSummary?.fallbackStorage?.provider || 'docketra_managed'} · {ownershipSummary?.fallbackStorage?.status || 'ACTIVE'}
                  </p>
                </div>
                <div className="rounded border border-[var(--dt-border-whisper)] bg-[var(--dt-surface)] px-3 py-2 md:col-span-2">
                  <p className="font-medium text-[var(--dt-text)]">Backup / export status</p>
                  <p className="text-[var(--dt-text-secondary)]">
                    Backup enabled: {ownershipSummary?.backupExport?.backupEnabled ? 'Yes' : 'No'} · Last export: {formatDateTime(ownershipSummary?.backupExport?.lastExport?.createdAt)}
                  </p>
                </div>
              </div>
              {summaryWarnings.length ? (
                <div className="rounded border border-[var(--dt-warning)] bg-[var(--dt-warning-subtle)] px-3 py-3 text-sm text-[var(--dt-warning)]">
                  <p className="font-medium">Warnings</p>
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    {summaryWarnings.map((warning) => (
                      <li key={warning.code}>{warning.message}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </Card>

          <Card>
            <div className={spacingClasses.sectionMargin}>
              <SupportContext context={supportContext} />
              <div>
                <h2 className="text-lg font-medium text-[var(--dt-text)] mb-2">Storage Provider</h2>
                <p className="text-sm text-[var(--dt-text-muted)]">BYOS trust mode is firm-connected storage so firm/client document bytes remain in firm-provided storage when configured. Docketra-managed storage remains the default fallback. Provider changes require OTP verification.</p>
              </div>
              <div className="rounded border border-[var(--dt-info)] bg-[var(--dt-info-subtle)] px-3 py-3 text-sm text-[var(--dt-info)]">
                <p className="font-medium">Current storage mode: {storageMode}</p>
                <p className="mt-1">
                  Firm-connected storage keeps document bytes in your firm-owned cloud environment.
                  Docketra-managed mode is operational fallback when BYOS is not connected.
                </p>
              </div>

              <div className={spacingClasses.formFieldSpacing}>
                <Select
                  label="Provider"
                  value={provider}
                  onChange={(event) => setProvider(event.target.value)}
                  options={[
                    { value: 'docketra_managed', label: 'Default (Docketra Storage)' },
                    { value: 'google-drive', label: 'Google Drive' },
                    { value: 'onedrive', label: 'Microsoft OneDrive' },
                    { value: 's3', label: 'Amazon S3 (or compatible)' },
                  ]}
                />
                <Input label="Status" value={connected ? 'Active' : 'Not Connected'} readOnly />
                <Input label="Storage mode" value={storageMode} readOnly />
                <Input label="Connected email" value={config?.connectedEmail || 'N/A'} readOnly />
                <Input label="Folder path" value={config?.folderPath || config?.rootFolderId || 'N/A'} readOnly />
                <Input label="Connected since" value={formatDateTime(config?.createdAt)} readOnly />
                {isOneDriveProvider ? (
                  <>
                    <Input label="OneDrive Refresh Token" value={oneDriveRefreshToken} onChange={(event) => setOneDriveRefreshToken(event.target.value)} />
                    <Input label="OneDrive Drive ID (optional)" value={oneDriveDriveId} onChange={(event) => setOneDriveDriveId(event.target.value)} />
                  </>
                ) : null}
                {isS3Provider ? (
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
                  <Button type="button" variant="outline" onClick={requestOtp}>Send OTP</Button>
                  <Button type="button" variant="outline" onClick={verifyOtp}>Verify OTP</Button>
                </div>
              </div>

              <div className={`${spacingClasses.formActions} ${spacingClasses.formActionsGap} flex-wrap`}>
                {isGoogleProvider ? (
                  <Button type="button" variant="primary" onClick={onConnectGoogleDrive} disabled={testing}>
                    Connect / Refresh Google Drive
                  </Button>
                ) : null}
                {connected ? (
                  <Button type="button" variant="outline" onClick={onTestConnection} disabled={testing} loading={testing}>
                    {testing ? 'Testing' : 'Test Connection'}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="primary"
                  onClick={onSaveStorageSettings}
                  disabled={!verificationToken || testing || savingProvider || !canSwitchProvider}
                >
                  {savingProvider ? 'Saving…' : canSwitchProvider ? 'Save Provider' : 'Provider Unchanged'}
                </Button>
                {!canSwitchProvider ? (
                  <p className="text-xs text-[var(--dt-text-muted)]">
                    Select a different provider before saving.
                  </p>
                ) : null}
                {!verificationToken ? (
                  <p className="text-xs text-[var(--dt-text-muted)]">
                    OTP verification is required before provider changes.
                  </p>
                ) : null}
              </div>
            </div>
          </Card>

          <Card>
            <div className={spacingClasses.sectionMargin}>
              <div>
                <h2 className="text-lg font-medium text-[var(--dt-text)] mb-2">Data ownership, backup, and export readiness</h2>
                <p className="text-sm text-[var(--dt-text-secondary)]">
                  Primary Admins can generate a firm backup export and review recent runs. If a download link is unavailable for your provider,
                  use the export history plus support diagnostics as the recovery path.
                </p>
              </div>
              <div className={`${spacingClasses.formActions} ${spacingClasses.formActionsGap} flex-wrap`}>
                <Button type="button" variant="primary" onClick={onRunExport} disabled={exporting} loading={exporting}>
                  {exporting ? 'Generating Export…' : 'Generate Firm Export'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    setExportsLoading(true);
                    try {
                      const exportData = await listStorageExports(10);
                      setExportRuns(Array.isArray(exportData?.data) ? exportData.data : []);
                    } finally {
                      setExportsLoading(false);
                    }
                  }}
                  disabled={exportsLoading}
                >
                  {exportsLoading ? 'Refreshing…' : 'Refresh Export History'}
                </Button>
              </div>
              <ul className="space-y-2 text-sm">
                {exportRuns.length === 0 ? (
                  <li className="text-[var(--dt-text-muted)]">No recent export runs found.</li>
                ) : exportRuns.map((item) => (
                  <li key={item?.exportId || item?._id} className="rounded border border-[var(--dt-border-whisper)] px-3 py-2">
                    <p className="font-medium text-[var(--dt-text)]">{item?.exportId || 'Export run'}</p>
                    <p className="text-[var(--dt-text-secondary)]">
                      Created: {formatDateTime(item?.createdAt || item?.timestamp)} · Files: {Number(item?.fileCount || 0)} · Size: {Number(item?.size || 0)} bytes
                    </p>
                    {!item?.downloadUrl ? (
                      <p className="text-[var(--dt-warning)]">Download link unavailable for this provider. Use support recovery path with export ID.</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </div>
      </div>
    </PlatformShell>
  );
}

export default StorageSettingsPage;
