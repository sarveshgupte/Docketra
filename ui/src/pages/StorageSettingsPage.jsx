import React, { useContext, useEffect, useState } from 'react';
import { Layout } from '../components/common/Layout';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { ToastContext } from '../contexts/ToastContext';
import {
  connectGoogleDrive,
  getStorageConfiguration,
  testStorageConnection,
} from '../services/storageService';

const formatDate = (value) => (value ? new Date(value).toLocaleString() : 'N/A');

export function StorageSettingsPage() {
  const toast = useContext(ToastContext);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);

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

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen bg-gray-50">
          <div className="w-full max-w-3xl mx-auto px-4 sm:px-container-x py-8 space-y-8">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-text-primary tracking-tight">Storage Settings</h1>
              <p className="text-sm text-gray-500">Configure and validate your external document storage integration.</p>
            </div>
            <Card className="p-6">
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
        <div className="w-full max-w-3xl mx-auto px-4 sm:px-container-x py-8 space-y-8">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-text-primary tracking-tight">Storage Settings</h1>
            <p className="text-sm text-gray-500">Configure and validate your external document storage integration.</p>
          </div>

          <Card className="p-6">
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-medium text-text-primary mb-4">Google Drive Connection</h2>
                <p className="text-sm text-gray-500">Authorize Google Drive to store firm documents and verify the integration health.</p>
              </div>

              <div className="space-y-5">
                <Input label="Provider" value="Google Drive" readOnly />
                <Input label="Status" value={connected ? 'Active' : 'Not Connected'} readOnly />
                <Input label="Connected email" value={config?.connectedEmail || 'N/A'} readOnly />
                <Input label="Folder path" value={config?.folderPath || config?.rootFolderId || 'N/A'} readOnly />
                <Input label="Connected since" value={formatDate(config?.createdAt)} readOnly />
              </div>

              <div className="mt-6 pt-5 border-t border-gray-200 flex justify-end gap-3">
                {!connected ? (
                  <Button type="button" variant="primary" onClick={onConnectGoogleDrive}>
                    Connect Google Drive
                  </Button>
                ) : (
                  <Button type="button" variant="primary" onClick={onTestConnection} disabled={testing}>
                    {testing ? 'Testing...' : 'Test Connection'}
                  </Button>
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
