import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PlatformShell } from '../../components/platform/PlatformShell';
import { EmptyState } from '../../components/common/EmptyState';
import { TableSkeleton } from '../../components/common/Skeleton';
import { worklistApi } from '../../api/worklist.api';
import { caseApi } from '../../api/case.api';
import { useToast } from '../../hooks/useToast';
import { ROUTES } from '../../constants/routes';
import { DataTable, toArray } from './PlatformShared';

export const PlatformWorkbasketsPage = () => {
  const { firmSlug } = useParams();
  const { showError, showSuccess } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await worklistApi.getGlobalWorklist({ limit: 50 });
      setRows(toArray(res?.data || res?.items));
    } catch (loadError) {
      setRows([]);
      setError(loadError?.message || 'Failed to load workbaskets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const handlePull = async (caseId) => {
    try {
      await caseApi.pullCase(caseId);
      showSuccess('Docket pulled into Worklist.');
      await loadRows();
    } catch (actionError) {
      showError(actionError?.message || 'Failed to pull docket');
    }
  };

  return (
    <PlatformShell title="Workbaskets" subtitle="Unassigned dockets pool">
      {loading ? <TableSkeleton rows={5} showToolbar={false} /> : null}
      {!loading && error ? (
        <EmptyState
          title="Couldn’t load Workbaskets"
          description={error}
          actionLabel="Retry"
          onAction={() => { void loadRows(); }}
          icon
        />
      ) : null}
      {!loading && !error && rows.length === 0 ? (
        <EmptyState
          title="No dockets yet"
          description="Workbaskets are empty. Create work through CMS intake or add your first docket manually."
          actionLabel="Create via CMS or manually"
          onAction={() => window.location.assign(ROUTES.CMS(firmSlug))}
          icon
        />
      ) : null}
      {!loading && !error && rows.length > 0 ? (
        <DataTable columns={['Docket ID', 'Client', 'Category', 'Created', 'Status', 'Actions']} rows={rows.map((r) => (
          <tr key={r.caseInternalId || r._id}><td>{r.docketId || r.caseInternalId}</td><td>{r.clientName || '-'}</td><td>{r.category || '-'}</td><td>{new Date(r.createdAt || Date.now()).toLocaleDateString()}</td><td>{r.status || 'NEW'}</td><td className="action-row"><button onClick={() => { void handlePull(r.caseInternalId); }} type="button">Pull to WL</button><Link to={ROUTES.CASE_DETAIL(firmSlug, r.caseInternalId)}>View</Link></td></tr>
        ))} />
      ) : null}
    </PlatformShell>
  );
};

export default PlatformWorkbasketsPage;
