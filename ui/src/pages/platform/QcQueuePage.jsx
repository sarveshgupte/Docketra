import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PlatformShell } from '../../components/platform/PlatformShell';
import { caseApi } from '../../api/case.api';
import { ROUTES } from '../../constants/routes';
import { DataTable, FilterBar, InlineNotice, PageSection, formatDocketLabel, toArray } from './PlatformShared';

export const PlatformQcQueuePage = () => {
  const { firmSlug } = useParams();
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadRows = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await caseApi.getCases({ state: 'IN_QC', limit: 50 });
      setRows(toArray(res?.data?.data || res?.data?.items));
    } catch {
      setRows([]);
      setError('Unable to load QC queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, []);

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((item) => [formatDocketLabel(item), item.assigneeName, item.assignedTo]
      .some((value) => String(value || '').toLowerCase().includes(needle)));
  }, [rows, query]);

  const clearFilters = () => setQuery('');

  const executeQcAction = async (caseInternalId, action, note) => {
    setSuccess('');
    try {
      await caseApi.qcAction(caseInternalId, action, note);
      setSuccess(`QC action ${action.toLowerCase()} completed.`);
      await loadRows();
    } catch {
      setError('QC action failed. Please retry.');
    }
  };

  return (
    <PlatformShell
      title="QC Queue"
      subtitle="Review dockets awaiting quality decisions"
      actions={<Link to={ROUTES.ADMIN_REPORTS(firmSlug)}>QC Reports</Link>}
    >
      <InlineNotice tone="error" message={error} />
      <InlineNotice tone="success" message={success} />
      <PageSection title="Quality decisions" description="Approve, reject, or return dockets to execution.">
        <FilterBar onClear={clearFilters} clearDisabled={!query}>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search docket or assignee"
            aria-label="Search QC queue"
          />
          <button type="button" onClick={() => void loadRows()} disabled={loading}>Refresh</button>
        </FilterBar>
        <DataTable
          columns={['Docket', 'Assignee', 'Time Spent', 'Actions']}
          rows={filteredRows.map((r) => (
            <tr key={r.caseInternalId || r._id}>
              <td>
                <Link className="action-primary" to={ROUTES.CASE_DETAIL(firmSlug, r.caseInternalId)}>
                  {formatDocketLabel(r)}
                </Link>
              </td>
              <td>{r.assigneeName || r.assignedTo || '-'}</td>
              <td>{r.timeSpent || '0m'}</td>
              <td>
                <div className="action-group-secondary" role="group" aria-label="QC actions">
                  <button type="button" onClick={() => void executeQcAction(r.caseInternalId, 'PASS', 'Passed from queue')}>Pass</button>
                  <button type="button" onClick={() => void executeQcAction(r.caseInternalId, 'CORRECT', 'Needs correction')}>Return for correction</button>
                  <button type="button" className="action-danger" onClick={() => void executeQcAction(r.caseInternalId, 'FAIL', 'Failed from queue')}>Fail</button>
                </div>
              </td>
            </tr>
          ))}
          loading={loading}
          error={error}
          emptyLabel="No dockets are currently waiting for QC."
        />
      </PageSection>
    </PlatformShell>
  );
};

export default PlatformQcQueuePage;
