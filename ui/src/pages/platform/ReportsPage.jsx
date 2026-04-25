import React, { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PlatformShell } from '../../components/platform/PlatformShell';
import { ROUTES } from '../../constants/routes';
import { DataTable, InlineNotice, PageSection, RefreshNotice, StatGrid } from './PlatformShared';
import { AccessDeniedState } from '../../components/feedback/AccessDeniedState';
import { getRecoveryPayload } from '../../utils/errorRecovery';
import { usePlatformReportsMetricsQuery } from '../../hooks/usePlatformDataQueries';

export const PlatformReportsPage = () => {
  const { firmSlug } = useParams();
  const {
    data: metrics = [],
    isLoading,
    isFetching,
    isError,
    error: queryError,
    refetch,
  } = usePlatformReportsMetricsQuery();

  const recovery = getRecoveryPayload(queryError, 'platform_queue');
  const isAccessDenied = isError && recovery.reasonCode === 'CASE_ACCESS_DENIED';

  const top = useMemo(() => metrics.slice(0, 5), [metrics]);
  const summaryCards = [
    { label: 'Metric buckets', value: metrics.length },
    { label: 'Top bucket value', value: Number(top[0]?.value || top[0]?.count || 0) },
    { label: 'Report health', value: isError ? 'Needs retry' : 'Available' },
  ];

  if (isAccessDenied) {
    return (
      <PlatformShell title="Access restricted" subtitle="Your session is active, but this module is currently not available for your role.">
        <AccessDeniedState supportContext={recovery.supportContext} />
      </PlatformShell>
    );
  }

  return (
    <PlatformShell
      title="Reports"
      subtitle="Productivity, quality, and workload insights for operational leadership"
      actions={<Link to={ROUTES.CASES(firmSlug)}>All Dockets</Link>}
    >
      <InlineNotice tone="error" message={isError ? 'Unable to load docket report metrics.' : ''} />
      <RefreshNotice refreshing={isFetching && !isLoading} message="Refreshing report metrics in the background…" />
      <StatGrid items={summaryCards} />
      <PageSection
        title="What this module is for"
        description="Reports summarize execution health over time. Data appears after dockets move through workbench, worklist, and QC."
      >
        <p className="muted">If this is empty, create and process a few dockets first to generate measurable trends.</p>
      </PageSection>

      <PageSection
        title="Performance trend"
        description="Top report buckets by current value."
        actions={(
          <>
            <button type="button" onClick={() => void refetch()} disabled={isFetching}>
              {isFetching ? 'Refreshing…' : 'Refresh metrics'}
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
          columns={['Docket metric', 'Value']}
          rows={metrics.map((m, index) => (
            <tr key={`${m.label || m.category || 'metric'}-${index}`}>
              <td>{m.label || m.category || `Bucket ${index + 1}`}</td>
              <td>{m.value || m.count || 0}</td>
            </tr>
          ))}
          loading={isLoading}
          error={isError ? 'Unable to load docket report metrics.' : ''}
          onRetry={() => void refetch()}
          emptyLabel="No report metrics yet. Complete at least one end-to-end docket cycle to generate report data."
        />
      </PageSection>
    </PlatformShell>
  );
};

export default PlatformReportsPage;
