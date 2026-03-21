import React, { useContext, useEffect, useState } from 'react';
import { ToastContext } from '../contexts/ToastContext';
import {
  connectGoogleDrive,
  getStorageConfiguration,
  testStorageConnection,
} from '../services/storageService';
import './StorageSettingsPage.css';

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

  if (loading) return <div className="storage-settings__loading">Loading storage settings...</div>;

  const connected = config?.isConfigured;

  return (
    <div className="storage-settings">
      <h1>Storage Settings</h1>
      {!connected ? (
        <button type="button" onClick={onConnectGoogleDrive}>Connect Google Drive</button>
      ) : (
        <>
          <p className="storage-settings__status"><strong>Provider:</strong> Google Drive</p>
          <p className="storage-settings__status"><strong>Status:</strong> Active</p>
          <p className="storage-settings__status"><strong>Connected email:</strong> {config?.connectedEmail || 'N/A'}</p>
          <p className="storage-settings__status"><strong>Folder path:</strong> {config?.folderPath || config?.rootFolderId || 'N/A'}</p>
          <p className="storage-settings__status"><strong>Connected since:</strong> {formatDate(config?.createdAt)}</p>
          <button type="button" onClick={onTestConnection} disabled={testing}>
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
        </>
      )}
    </div>
  );
}

export default StorageSettingsPage;
