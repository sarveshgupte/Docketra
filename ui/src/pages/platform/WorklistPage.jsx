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

export const PlatformWorklistPage = () => {
  const { firmSlug } = useParams();
  const { showError, showSuccess } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await worklistApi.getEmployeeWorklist({ limit: 50 });
      setRows(toArray(res?.data || res?.items));
    } catch (loadError) {
      setRows([]);
      setError(loadError?.message || 'Failed to load worklist');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const runAction = async (task, successMessage) => {
    try {
      await task();
      showSuccess(successMessage);
      await loadRows();
    } catch (actionError) {
      showError(actionError?.message || 'Action failed');
    }
  };

  return (
    <PlatformShell title="My Worklist" subtitle="Your active dockets and fastest actions">
      {loading ? <TableSkeleton rows={5} showToolbar={false} /> : null}
      {!loading && error ? (
        <EmptyState
          title="Couldn’t load your Worklist"
          description={error}
          actionLabel="Retry"
          onAction={() => { void loadRows(); }}
          icon
        />
      ) : null}
      {!loading && !error && rows.length === 0 ? (
        <EmptyState
          title="No active work"
          description="Your Worklist is clear. Pull a docket from Workbaskets to begin execution."
          actionLabel="Pull from Workbaskets"
          onAction={() => window.location.assign(ROUTES.GLOBAL_WORKLIST(firmSlug))}
          icon
        />
      ) : null}
      {!loading && !error && rows.length > 0 ? (
        <DataTable columns={['Docket', 'Client', 'Time Spent', 'Status', 'Actions']} rows={rows.map((r) => (
          <tr key={r.caseInternalId || r._id}><td>{r.docketId || r.caseInternalId}</td><td>{r.clientName || '-'}</td><td>{r.timeSpent || '0m'}</td><td>{r.status || 'IN_PROGRESS'}</td><td className="action-row"><Link to={ROUTES.CASE_DETAIL(firmSlug, r.caseInternalId)}>Open docket</Link><button type="button" onClick={() => { void runAction(() => caseApi.transitionDocket(r.caseInternalId, { toState: 'RESOLVED', sendToQC: true, comment: 'Sent to QC from worklist' }), 'Docket moved to QC.'); }}>Send to QC</button><button type="button" onClick={() => { void runAction(() => caseApi.pendCase(r.caseInternalId, 'Pending via table action'), 'Docket moved to pending.'); }}>Pend</button><button type="button" onClick={() => { void runAction(() => caseApi.resolveCase(r.caseInternalId, 'Resolved via table action'), 'Docket resolved.'); }}>Resolve</button><button type="button" onClick={() => { void runAction(() => caseApi.fileCase(r.caseInternalId, 'Filed via table action'), 'Docket filed.'); }}>File</button></td></tr>
        ))} />
      ) : null}
    </PlatformShell>
  );
};

export default PlatformWorklistPage;
