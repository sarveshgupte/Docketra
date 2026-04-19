import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PlatformShell } from '../../components/platform/PlatformShell';
import { reportsService } from '../../services/reports.service';
import { ROUTES } from '../../constants/routes';
import { DataTable, InlineNotice, PageSection, RefreshNotice, StatGrid, toArray } from './PlatformShared';

export const PlatformReportsPage = () => {
  const { firmSlug } = useParams();
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = async ({ background = false } = {}) => {
    if (background && metrics.length > 0) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const res = await reportsService.getCaseMetrics();
      setMetrics(toArray(res?.data?.data));
    } catch {
      setMetrics([]);
      setError('Unable to load reports metrics.');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const top = useMemo(() => metrics.slice(0, 5), [metrics]);
  const summaryCards = [
    { label: 'Metric buckets', value: metrics.length },
    { label: 'Top bucket value', value: Number(top[0]?.value || top[0]?.count || 0) },
    { label: 'Report health', value: error ? 'Needs retry' : 'Available' },
  ];

  return (
    <PlatformShell
      title="Reports"
      subtitle="Productivity, quality, and workload insights for operational leadership"
      actions={<Link to={ROUTES.CASES(firmSlug)}>All Dockets</Link>}
    >
      <InlineNotice tone="error" message={error} />
      <RefreshNotice refreshing={refreshing} message="Refreshing report metrics in the background…" />
      <StatGrid items={summaryCards} />

      <PageSection
        title="Performance trend"
        description="Top report buckets by current value."
        actions={(
          <>
            <button type="button" onClick={() => void load({ background: true })} disabled={loading || refreshing}>
              {refreshing ? 'Refreshing…' : 'Refresh metrics'}
            </button>
            <Link to={`/app/firm/${firmSlug}/admin/reports/detailed`}>Open detailed reports</Link>
          </>
        )}
      >
        {top.map((m, index) => (
          <div key={`${m.label || m.category || 'bucket'}-${index}`}>
            <p className="muted">{m.label || m.category || `Bucket ${index + 1}`}</p>
            <div className="bar">
              <span style={{ width: `${Math.min(100, Number(m.value || m.count || 0))}%` }} />
            </div>
          </div>
        ))}
      </PageSection>

      <PageSection title="Metric table" description="Structured view for faster scanning and export checks.">
        <DataTable
          columns={['Metric', 'Value']}
          rows={metrics.map((m, index) => (
            <tr key={`${m.label || m.category || 'metric'}-${index}`}>
              <td>{m.label || m.category || `Bucket ${index + 1}`}</td>
              <td>{m.value || m.count || 0}</td>
            </tr>
          ))}
          loading={loading}
          error={error}
          onRetry={() => void load()}
          emptyLabel="No metrics are available for the selected period."
        />
      </PageSection>
    </PlatformShell>
  );
};

export default PlatformReportsPage;
