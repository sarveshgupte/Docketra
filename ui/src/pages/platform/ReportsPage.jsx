import React, { useMemo, useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PlatformShell } from '../../components/platform/PlatformShell';
import { ROUTES } from '../../constants/routes';
import { DataTable, PageSection, StatGrid, StatusMessageStack } from './PlatformShared';
import { AccessDeniedState } from '../../components/feedback/AccessDeniedState';
import { getRecoveryPayload } from '../../utils/errorRecovery';
import { usePlatformReportsMetricsQuery } from '../../hooks/usePlatformDataQueries';
import { useAuth } from '../../hooks/useAuth';
import { docketEffortApi } from '../../api/docketEffort.api';

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
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'owner' || user?.role === 'primary_admin' || user?.role === 'PRIMARY_ADMIN' || user?.role === 'ADMIN';

  const [profitabilityReport, setProfitabilityReport] = useState(null);
  const [profitabilityReportLoading, setProfitabilityReportLoading] = useState(false);
  const [activeReportTab, setActiveReportTab] = useState('budget');

  useEffect(() => {
    if (!isAdmin) return;
    let isCancelled = false;
    const fetchProfitability = async () => {
      setProfitabilityReportLoading(true);
      try {
        const res = await docketEffortApi.getProfitabilityReports();
        if (!isCancelled && res.success) {
          setProfitabilityReport(res.data);
        }
      } catch (err) {
        console.error('Failed to load profitability reports:', err);
      } finally {
        if (!isCancelled) setProfitabilityReportLoading(false);
      }
    };
    fetchProfitability();
    return () => { isCancelled = true; };
  }, [isAdmin]);

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
      moduleLabel="Reports / Operations Insights"
      title="Reports"
      subtitle="Productivity, quality, and workload insights for operational leadership"
      actions={<Link to={ROUTES.TASK_MANAGER(firmSlug)}>Task Manager</Link>}
    >
      <StatusMessageStack
        messages={[
          { tone: 'error', message: isError ? 'Unable to load docket report metrics.' : '' },
          { tone: 'info', message: isFetching && !isLoading ? 'Refreshing report metrics in the background…' : '' },
        ]}
      />
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

      {isAdmin && profitabilityReport && (
        <PageSection
          title="💰 Firm Effort & Profitability Analytics (Admin-Only)"
          description="Detailed visual analysis comparing time logged against target budgets, client effort footprint, and variance."
        >
          {/* Sub Tab Navigation for Analytics */}
          <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e5e7eb', marginBottom: '16px', paddingBottom: '2px' }}>
            <button
              type="button"
              onClick={() => setActiveReportTab('budget')}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: activeReportTab === 'budget' ? '2px solid #4f46e5' : '2px solid transparent',
                color: activeReportTab === 'budget' ? '#4f46e5' : '#6b7280',
                padding: '8px 16px',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              📅 Budget vs Actual
            </button>
            <button
              type="button"
              onClick={() => setActiveReportTab('clients')}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: activeReportTab === 'clients' ? '2px solid #4f46e5' : '2px solid transparent',
                color: activeReportTab === 'clients' ? '#4f46e5' : '#6b7280',
                padding: '8px 16px',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              👥 Client Footprint
            </button>
            <button
              type="button"
              onClick={() => setActiveReportTab('variance')}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: activeReportTab === 'variance' ? '2px solid #4f46e5' : '2px solid transparent',
                color: activeReportTab === 'variance' ? '#4f46e5' : '#6b7280',
                padding: '8px 16px',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              📊 Service-Line Variance
            </button>
          </div>

          {/* Sub Tab 1: Budget vs Actual Table */}
          {activeReportTab === 'budget' && (
            <DataTable
              columns={['Docket ID', 'Description', 'Client', 'Budget (Fee)', 'Actual Cost', 'Variance (Cost)', 'Expected Mins', 'Actual Mins', 'Time Variance']}
              rows={(profitabilityReport.budgetVsActual || []).map((row, idx) => {
                const costVarianceIsNegative = row.costVariance < 0;
                const timeVarianceIsNegative = row.timeVariance < 0;
                return (
                  <tr key={`${row.caseId}-${idx}`}>
                    <td style={{ fontWeight: '600', color: '#111827' }}>{row.caseId}</td>
                    <td style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.title}</td>
                    <td>{row.clientId || '—'}</td>
                    <td>₹{row.estimatedBudget}</td>
                    <td>₹{row.actualCost}</td>
                    <td style={{ fontWeight: '700', color: costVarianceIsNegative ? '#059669' : row.costVariance > 0 ? '#dc2626' : '#374151' }}>
                      {row.costVariance > 0 ? `+₹${row.costVariance}` : row.costVariance < 0 ? `-₹${Math.abs(row.costVariance)}` : '₹0'}
                    </td>
                    <td>{row.expectedMinutes}m</td>
                    <td>{row.actualMinutes}m</td>
                    <td style={{ fontWeight: '700', color: timeVarianceIsNegative ? '#059669' : row.timeVariance > 0 ? '#dc2626' : '#374151' }}>
                      {row.timeVariance > 0 ? `+${row.timeVariance}m` : row.timeVariance < 0 ? `-${Math.abs(row.timeVariance)}m` : '0m'}
                    </td>
                  </tr>
                );
              })}
              loading={profitabilityReportLoading}
              emptyLabel="No time logs or target budgets set for recurring obligations yet."
            />
          )}

          {/* Sub Tab 2: Client Footprint */}
          {activeReportTab === 'clients' && (
            <DataTable
              columns={['Client ID / Code', 'Total Time Consumed', 'Filing Time Entries Count']}
              rows={(profitabilityReport.clientSummary || []).map((row, idx) => (
                <tr key={`${row.clientId}-${idx}`}>
                  <td style={{ fontWeight: '600', color: '#111827' }}>{row.clientId}</td>
                  <td style={{ fontWeight: '700', color: '#4f46e5' }}>{row.totalMinutes} minutes</td>
                  <td>{row.entriesCount} effort records</td>
                </tr>
              ))}
              loading={profitabilityReportLoading}
              emptyLabel="No client-level effort entries logged yet."
            />
          )}

          {/* Sub Tab 3: Service-Line Variance */}
          {activeReportTab === 'variance' && (
            <DataTable
              columns={['Service Line', 'Total Dockets', 'Total Expected Time', 'Total Actual Time', 'Time Variance', 'Avg Expected Time', 'Avg Actual Time']}
              rows={(profitabilityReport.obligationVariance || []).map((row, idx) => {
                const isOverBudget = row.varianceMinutes > 0;
                return (
                  <tr key={`${row.serviceLine}-${idx}`}>
                    <td style={{ fontWeight: '600', textTransform: 'capitalize', color: '#111827' }}>{row.serviceLine.replace(/_/g, ' ')}</td>
                    <td>{row.docketsCount}</td>
                    <td>{row.totalExpected}m</td>
                    <td>{row.totalActual}m</td>
                    <td style={{ fontWeight: '700', color: isOverBudget ? '#dc2626' : row.varianceMinutes < 0 ? '#059669' : '#374151' }}>
                      {row.varianceMinutes > 0 ? `+${row.varianceMinutes}m` : row.varianceMinutes < 0 ? `-${Math.abs(row.varianceMinutes)}m` : '0m'}
                    </td>
                    <td>{row.avgExpectedMinutes}m</td>
                    <td>{row.avgActualMinutes}m</td>
                  </tr>
                );
              })}
              loading={profitabilityReportLoading}
              emptyLabel="No obligation category effort records captured yet."
            />
          )}
        </PageSection>
      )}
    </PlatformShell>
  );
};

export default PlatformReportsPage;
