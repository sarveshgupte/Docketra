import React, { useContext, useEffect, useState } from 'react';
import { Layout } from '../components/common/Layout';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Select } from '../components/common/Select';
import { ToastContext } from '../contexts/ToastContext';
import {
  changeStorageProvider,
  connectGoogleDrive,
  getStorageConfiguration,
  sendStorageChangeOtp,
  testStorageConnection,
  verifyStorageChangeOtp,
} from '../services/storageService';
import { useAuth } from '../hooks/useAuth';
import { spacingClasses } from '../theme/tokens';
import { formatDateTime } from '../utils/formatDateTime';

export function StorageSettingsPage() {
  const toast = useContext(ToastContext);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
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
  const { user } = useAuth();

  const loadConfiguration = async () => {
    try {
      const data = await getStorageConfiguration();
      setConfig(data);
    } catch (error) {
      toast?.showError?.(error?.response?.data?.message || 'Failed to load storage configuration.');
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
    try {
      const result = await testStorageConnection();
      toast?.showSuccess?.(result?.message || 'Storage connection is healthy.');
      await loadConfiguration();
    } catch (error) {
      toast?.showError?.(error?.response?.data?.message || 'Storage connection test failed.');
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
      await loadConfiguration();
    } catch (error) {
      toast?.showError?.(error?.response?.data?.message || 'Failed to update storage');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-50">
          <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Storage Settings</h1>
              <p className="text-sm text-gray-500">Configure and validate your external document storage integration.</p>
            </div>
            <Card>
              <p className="text-sm text-gray-500">Loading storage settings...</p>
            </Card>
          </div>
        </div>
      </Layout>
    );
  }

  const connected = config?.isConfigured;
  const isGoogleProvider = provider === 'google-drive';
  const isOneDriveProvider = provider === 'onedrive';
  const isS3Provider = provider === 's3';
  const canSwitchProvider = provider !== (config?.provider || 'docketra_managed');

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">
        <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Storage Settings</h1>
            <p className="text-sm text-gray-500">Configure and validate your external document storage integration.</p>
          </div>

          <Card>
            <div className={spacingClasses.sectionMargin}>
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-4">Storage Provider</h2>
                <p className="text-sm text-gray-500">Default is Docketra managed storage. BYOS changes require OTP verification.</p>
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
                <div className={`grid grid-cols-1 md:grid-cols-3 ${spacingClasses.formActionsGap} items-end`}>
                  <Input label="OTP Code" value={otpCode} onChange={(event) => setOtpCode(event.target.value)} />
                  <Button type="button" variant="outline" onClick={requestOtp}>Send OTP</Button>
                  <Button type="button" variant="outline" onClick={verifyOtp}>Verify OTP</Button>
                </div>
              </div>

              <div className={`${spacingClasses.formActions} ${spacingClasses.formActionsGap}`}>
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
                  disabled={!verificationToken || testing || !canSwitchProvider}
                >
                  {canSwitchProvider ? 'Save Provider' : 'Provider Unchanged'}
                </Button>
                {!canSwitchProvider ? (
                  <p className="text-xs text-gray-500">
                    Select a different provider before saving.
                  </p>
                ) : null}
                {!verificationToken ? (
                  <p className="text-xs text-gray-500">
                    OTP verification is required before provider changes.
                  </p>
                ) : null}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
}

export default StorageSettingsPage;
