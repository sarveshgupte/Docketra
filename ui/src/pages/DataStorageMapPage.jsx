import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlatformShell } from '../components/platform/PlatformShell';
import { PageHeader } from '../components/layout/PageHeader';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { getStorageDataMap } from '../services/storageService';
import { formatDateTime } from '../utils/formatDateTime';
import { ROUTES } from '../constants/routes';

export function DataStorageMapPage() {
  const [dataMap, setDataMap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await getStorageDataMap();
        setDataMap(data);
      } catch {
        setError('Unable to load your Data Storage Map right now.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <PlatformShell moduleLabel="Settings" title="Data Storage Map" subtitle="Trust transparency for storage and metadata boundaries.">
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 space-y-6">
        <PageHeader title="Data Storage Map" subtitle={dataMap?.message || 'Your business data lives in your firm cloud storage. Docketra stores only control-plane metadata needed to run the app.'} />
        {loading ? <Card><p>Loading…</p></Card> : null}
        {error ? <Card><p className="text-[var(--dt-danger)]">{error}</p></Card> : null}
        {!loading && dataMap ? (
          <>
            <Card className="space-y-2 p-4">
              <h2 className="text-lg font-medium">Active storage provider</h2>
              <p>{dataMap.activeStorage?.providerLabel || 'N/A'}</p>
              <p>Connected email: {dataMap.activeStorage?.connectedEmail || 'N/A'}</p>
              <p>Last storage health check: {formatDateTime(dataMap.activeStorage?.lastStorageHealthCheck)}</p>
              <p>Storage capacity: {dataMap.activeStorage?.storageCapacity?.displayUsed ? `${dataMap.activeStorage.storageCapacity.displayUsed} / ${dataMap.activeStorage.storageCapacity.displayTotal}` : 'Not available for this provider'}</p>
            </Card>

            <Card className="space-y-2 p-4">
              <h2 className="text-lg font-medium">Business data locations</h2>
              <p>Client profiles → {dataMap.businessDataLocations?.clientProfiles}</p>
              <p>Client CFS → {dataMap.businessDataLocations?.clientCfs}</p>
              <p>Attachments → {dataMap.businessDataLocations?.attachments}</p>
              <p>Dockets/tasks/comments → {dataMap.businessDataLocations?.docketsTasksComments}</p>
            </Card>

            <Card className="space-y-2 p-4">
              <h2 className="text-lg font-medium">MongoDB control-plane data</h2>
              <ul className="list-disc pl-6">
                {(dataMap.mongoControlPlaneCategories || []).map((item) => <li key={item}>{item}</li>)}
              </ul>
            </Card>

            <Card className="space-y-3 p-4">
              <h2 className="text-lg font-medium">Verification actions</h2>
              {dataMap.verificationActions?.openFirmCloudFolderUrl ? (
                <a className="text-[var(--dt-link)] underline" href={dataMap.verificationActions.openFirmCloudFolderUrl} target="_blank" rel="noreferrer">Open firm Google Drive folder</a>
              ) : <p>Firm Google Drive folder link is available when BYOS is connected.</p>}
              <a className="text-[var(--dt-link)] underline block" href={dataMap.verificationActions?.downloadResidencySummaryPath}>Download Data Residency Summary (text)</a>
              <a className="text-[var(--dt-link)] underline block" href={dataMap.verificationActions?.policyDocPath}>View data residency policy</a>
              <Link to={ROUTES.STORAGE_SETTINGS(dataMap?.firm?.slug || '')}><Button type="button" variant="outline">Back to Storage Settings</Button></Link>
            </Card>
          </>
        ) : null}
      </div>
    </PlatformShell>
  );
}
