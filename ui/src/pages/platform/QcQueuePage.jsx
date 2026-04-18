import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PlatformShell } from '../../components/platform/PlatformShell';
import { EmptyState } from '../../components/common/EmptyState';
import { TableSkeleton } from '../../components/common/Skeleton';
import { caseApi } from '../../api/case.api';
import { useToast } from '../../hooks/useToast';
import { ROUTES } from '../../constants/routes';
import { DataTable, toArray } from './PlatformShared';

export const PlatformQcQueuePage = () => {
  const { firmSlug } = useParams();
  const { showError, showSuccess } = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await caseApi.getCases({ state: 'IN_QC', limit: 50 });
      setRows(toArray(res?.data || res?.items));
    } catch (loadError) {
      setRows([]);
      setError(loadError?.message || 'Failed to load QC queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const runQcAction = async (caseId, decision, message) => {
    try {
      await caseApi.qcAction(caseId, decision, `${message} from QC queue`);
      showSuccess(message);
      await loadRows();
    } catch (actionError) {
      showError(actionError?.message || 'Failed to apply QC action');
    }
  };

  return (
    <PlatformShell title="QC Queue" subtitle="Review queue for quality control decisions">
      {loading ? <TableSkeleton rows={5} showToolbar={false} /> : null}
      {!loading && error ? (
        <EmptyState
          title="Couldn’t load QC"
          description={error}
          actionLabel="Retry"
          onAction={() => { void loadRows(); }}
          icon
        />
      ) : null}
      {!loading && !error && rows.length === 0 ? (
        <EmptyState
          title="No items in QC"
          description="Nothing is waiting for review right now."
          actionLabel="Open Worklist"
          onAction={() => window.location.assign(ROUTES.WORKLIST(firmSlug))}
          icon
        />
      ) : null}
      {!loading && !error && rows.length > 0 ? (
        <DataTable columns={['Docket', 'User', 'Time Spent', 'Actions']} rows={rows.map((r) => (
          <tr key={r.caseInternalId || r._id}><td>{r.docketId || r.caseInternalId}</td><td>{r.assigneeName || r.assignedTo || '-'}</td><td>{r.timeSpent || '0m'}</td><td className="action-row"><Link to={ROUTES.CASE_DETAIL(firmSlug, r.caseInternalId)}>Review</Link><button type="button" onClick={() => { void runQcAction(r.caseInternalId, 'PASSED', 'QC passed.'); }}>Pass</button><button type="button" onClick={() => { void runQcAction(r.caseInternalId, 'FAILED', 'QC failed.'); }}>Fail</button><button type="button" onClick={() => { void runQcAction(r.caseInternalId, 'CORRECTED', 'QC correction requested.'); }}>Correct</button></td></tr>
        ))} />
      ) : null}
    </PlatformShell>
  );
};

export default PlatformQcQueuePage;
