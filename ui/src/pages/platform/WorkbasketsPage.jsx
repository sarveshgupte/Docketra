import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { PlatformShell } from '../../components/platform/PlatformShell';
import { worklistApi } from '../../api/worklist.api';
import { caseApi } from '../../api/case.api';
import { ROUTES } from '../../constants/routes';
import {
  DataTable,
  FilterBar,
  InlineNotice,
  PageSection,
  RefreshNotice,
  formatDocketLabel,
  toArray,
} from './PlatformShared';

export const PlatformWorkbasketsPage = () => {
  const { firmSlug } = useParams();
  const location = useLocation();
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pendingPullId, setPendingPullId] = useState('');

  const loadRows = async ({ background = false } = {}) => {
    if (background && rows.length > 0) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const res = await worklistApi.getGlobalWorklist({ limit: 50 });
      setRows(toArray(res?.data?.data || res?.data?.items));
    } catch {
      setRows([]);
      setError('Unable to load workbaskets.');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, []);

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((item) => [formatDocketLabel(item), item.clientName, item.category]
      .some((value) => String(value || '').toLowerCase().includes(needle)));
  }, [rows, query]);

  const clearFilters = () => setQuery('');

  const pullToWorklist = async (caseInternalId) => {
    setSuccess('');
    setPendingPullId(caseInternalId);
    try {
      await caseApi.pullCase(caseInternalId);
      setSuccess('Docket pulled to worklist.');
      await loadRows({ background: true });
    } catch {
      setError('Unable to pull docket to worklist.');
    } finally {
      setPendingPullId('');
    }
  };

  return (
    <PlatformShell
      title="Workbaskets"
      subtitle="Firm-level intake and unassigned docket triage"
      actions={<Link to={ROUTES.CASES(firmSlug)}>All Dockets</Link>}
    >
      <InlineNotice tone="error" message={error} />
      <InlineNotice tone="success" message={success} />
      <RefreshNotice refreshing={refreshing} message="Refreshing workbaskets in the background…" />
      <PageSection title="Unassigned dockets" description="Pull dockets to execution queues as owners are identified.">
        <FilterBar onClear={clearFilters} clearDisabled={!query}>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search docket, client, category"
            aria-label="Search workbaskets"
          />
          <button type="button" onClick={() => void loadRows({ background: rows.length > 0 })} disabled={loading || refreshing}>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </FilterBar>

        <DataTable
          columns={['Docket', 'Client', 'Category', 'Created', 'Status', 'Actions']}
          rows={filteredRows.map((r) => (
            <tr key={r.caseInternalId || r._id}>
              <td>
                <Link className="action-primary" to={`${ROUTES.CASE_DETAIL(firmSlug, r.caseInternalId)}?returnTo=${encodeURIComponent(`${location.pathname}${location.search || ''}`)}`}>
                  {formatDocketLabel(r)}
                </Link>
              </td>
              <td>{r.clientName || '-'}</td>
              <td>{r.category || '-'}</td>
              <td>{new Date(r.createdAt || Date.now()).toLocaleDateString()}</td>
              <td>{String(r.status || 'NEW').replace('_', ' ')}</td>
              <td>
                <div className="action-group-secondary" role="group" aria-label="Workbasket actions">
                  <button onClick={() => void pullToWorklist(r.caseInternalId)} type="button" disabled={pendingPullId === r.caseInternalId}>
                    {pendingPullId === r.caseInternalId ? 'Pulling…' : 'Pull to Worklist'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
          loading={loading}
          error={error}
          onRetry={() => void loadRows()}
          hasActiveFilters={Boolean(query.trim())}
          emptyLabel="No unassigned dockets are available right now."
          emptyLabelFiltered="No workbasket dockets match your search."
        />
      </PageSection>
    </PlatformShell>
  );
};

export default PlatformWorkbasketsPage;
