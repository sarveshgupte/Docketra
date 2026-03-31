import React, { useContext, useEffect, useState } from 'react';
import { Layout } from '../components/common/Layout';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
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

const formatDate = (value) => (value ? new Date(value).toLocaleString() : 'N/A');

export function StorageSettingsPage() {
  const toast = useContext(ToastContext);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [provider, setProvider] = useState('docketra_managed');
  const [otpCode, setOtpCode] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [googleRefreshToken, setGoogleRefreshToken] = useState('');
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
      await changeStorageProvider({
        provider,
        verificationToken,
        credentials: provider === 'google-drive' ? { googleRefreshToken } : {},
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

              <div className="space-y-5">
                <label className="block">
                  <span className="text-sm text-gray-600">Provider</span>
                  <select className="mt-1 w-full border rounded-md px-3 py-2" value={provider} onChange={(event) => setProvider(event.target.value)}>
                    <option value="docketra_managed">Default (Docketra Storage)</option>
                    <option value="google-drive">Google Drive</option>
                    <option value="s3">AWS S3 (future)</option>
                  </select>
                </label>
                <Input label="Status" value={connected ? 'Active' : 'Not Connected'} readOnly />
                <Input label="Connected email" value={config?.connectedEmail || 'N/A'} readOnly />
                <Input label="Folder path" value={config?.folderPath || config?.rootFolderId || 'N/A'} readOnly />
                <Input label="Connected since" value={formatDate(config?.createdAt)} readOnly />
                {provider === 'google-drive' ? (
                  <Input
                    label="Google Refresh Token"
                    value={googleRefreshToken}
                    onChange={(event) => setGoogleRefreshToken(event.target.value)}
                    placeholder="Paste encrypted-source refresh token"
                  />
                ) : null}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                  <Input label="OTP Code" value={otpCode} onChange={(event) => setOtpCode(event.target.value)} />
                  <Button type="button" variant="secondary" onClick={requestOtp}>Send OTP</Button>
                  <Button type="button" variant="secondary" onClick={verifyOtp}>Verify OTP</Button>
                </div>
              </div>

              <div className="mt-6 pt-5 border-t border-gray-200 flex justify-end gap-3">
                {!connected ? (
                  <Button type="button" variant="primary" onClick={onConnectGoogleDrive}>
                    Connect Google Drive
                  </Button>
                ) : (
                  <>
                    <Button type="button" variant="secondary" onClick={onTestConnection} disabled={testing}>
                      {testing ? 'Testing...' : 'Test Connection'}
                    </Button>
                    <Button type="button" variant="primary" onClick={onSaveStorageSettings} disabled={!verificationToken}>
                      Save Provider
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
}

export default StorageSettingsPage;
