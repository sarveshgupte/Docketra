import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PlatformShell } from '../../components/platform/PlatformShell';
import { ROUTES } from '../../constants/routes';
import { DataTable, PageSection, StatGrid, StatusBadge, StatusMessageStack } from './PlatformShared';
import { AccessDeniedState } from '../../components/feedback/AccessDeniedState';
import { getRecoveryPayload } from '../../utils/errorRecovery';
import { usePlatformReportsMetricsQuery } from '../../hooks/usePlatformDataQueries';
import { useAuth } from '../../hooks/useAuth';
import { docketEffortApi } from '../../api/docketEffort.api';

export const PlatformReportsPage = () => {
  const { firmSlug } = useParams();
  const {
    data: rawMetrics,
    isLoading,
    isFetching,
    isError,
    error: queryError,
    refetch,
  } = usePlatformReportsMetricsQuery();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'owner' || user?.role === 'primary_admin' || user?.role === 'PRIMARY_ADMIN' || user?.role === 'ADMIN';

  const [activeTab, setActiveTab] = useState('operations'); // 'operations' | 'profitability'
  const [profitabilityReport, setProfitabilityReport] = useState(null);
  const [profitabilityReportLoading, setProfitabilityReportLoading] = useState(false);
  const [activeReportTab, setActiveReportTab] = useState('budget'); // 'budget' | 'clients' | 'variance'

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

  // Normalize metrics from either array shape or object payload
  const normalized = useMemo(() => {
    if (Array.isArray(rawMetrics)) {
      const topBuckets = rawMetrics.slice(0, 5);
      const total = rawMetrics.length;
      return {
        totalCases: total,
        openCases: 0,
        pendedCases: 0,
        pendingApprovals: 0,
        filedCases: 0,
        resolvedCases: 0,
        overdueCases: 0,
        avgResolutionTimeSeconds: 0,
        casesCreatedToday: 0,
        casesResolvedToday: 0,
        byCategory: {},
        topBuckets,
      };
    }
    const data = rawMetrics || {};
    const totalCases = Number(data.totalCases || 0);
    const byStatus = data.byStatus || {};
    const openCases = Number(byStatus.OPEN || byStatus.Open || 0);
    const pendedCases = Number(byStatus.PENDING || byStatus.Pending || 0);
    const filedCases = Number(byStatus.FILED || byStatus.Filed || 0);
    const resolvedCases = Number(byStatus.RESOLVED || byStatus.Resolved || byStatus.Closed || 0);
    const overdueCases = Number(data.overdueCases || 0);
    const pendingApprovals = Number(data.pendingApprovals || 0);
    const avgResolutionTimeSeconds = Number(data.avgResolutionTimeSeconds || 0);
    const casesCreatedToday = Number(data.casesCreatedToday || 0);
    const casesResolvedToday = Number(data.casesResolvedToday || 0);
    const byCategory = data.byCategory || {};

    return {
      totalCases,
      openCases,
      pendedCases,
      pendingApprovals,
      filedCases,
      resolvedCases,
      overdueCases,
      avgResolutionTimeSeconds,
      casesCreatedToday,
      casesResolvedToday,
      byCategory,
      topBuckets: [],
    };
  }, [rawMetrics]);

  const totalVolume = normalized.totalCases;
  const completedVolume = normalized.filedCases + normalized.resolvedCases;
  const slaRate = totalVolume > 0
    ? Math.max(0, Math.round(((totalVolume - normalized.overdueCases) / totalVolume) * 100))
    : 100;

  const avgDays = normalized.avgResolutionTimeSeconds > 0
    ? Math.max(1, Math.round(normalized.avgResolutionTimeSeconds / 86400))
    : 0;

  const calcPercent = useCallback((val) => {
    if (!totalVolume || totalVolume <= 0) return 0;
    return Math.min(100, Math.round((val / totalVolume) * 100));
  }, [totalVolume]);

  const summaryCards = [
    {
      label: 'Total Matter Volume',
      value: isLoading ? '…' : totalVolume,
      helpText: totalVolume > 0
        ? `${normalized.openCases} active · ${completedVolume} filed`
        : 'Lifetime dockets in workspace',
    },
    {
      label: 'On-Time SLA Rate',
      value: isLoading ? '…' : `${slaRate}%`,
      helpText: normalized.overdueCases > 0
        ? `${normalized.overdueCases} past statutory deadline`
        : 'Zero statutory breaches',
    },
    {
      label: 'Turnaround Velocity',
      value: isLoading ? '…' : (avgDays > 0 ? `${avgDays} days` : 'Within SLA'),
      helpText: 'Intake to filing timeframe',
    },
    {
      label: 'QC Review Queue',
      value: isLoading ? '…' : (normalized.pendingApprovals > 0 ? `${normalized.pendingApprovals} awaiting QC` : 'Queue Clear'),
      helpText: normalized.pendingApprovals > 0 ? 'Pending sign-off' : 'All reviews completed',
    },
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
      moduleLabel="Practice Analytics"
      title="Operations & Practice Reports"
      subtitle="Executive turnaround velocity, statutory SLA compliance, and firm profitability"
      actions={(
        <div className="reports-header-actions">
          <Link to={`/app/firm/${firmSlug}/admin/reports/detailed`} className="reports-head-btn">
            Detailed Register →
          </Link>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="reports-head-btn reports-head-btn--ghost"
            title="Refresh practice analytics"
          >
            {isFetching ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      )}
    >
      <StatusMessageStack
        messages={[
          { tone: 'error', message: isError ? 'Unable to load docket report metrics.' : '' },
          { tone: 'info', message: isFetching && !isLoading ? 'Refreshing report metrics in the background…' : '' },
        ]}
      />

      {/* Top Executive KPI Cards */}
      <StatGrid items={summaryCards} />

      {/* First-time / Zero-state Graceful Onboarding Banner */}
      {totalVolume === 0 && !isLoading && (
        <div className="reports-onboarding-card">
          <div className="reports-onboarding-card__icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18" />
              <path d="M18 17V9" />
              <path d="M13 17V5" />
              <path d="M8 17v-3" />
            </svg>
          </div>
          <div className="reports-onboarding-card__content">
            <h3 className="reports-onboarding-card__title">Practice Analytics Initialized</h3>
            <p className="reports-onboarding-card__text">
              Turnaround curves, statutory SLA tracking, and staff profitability insights will aggregate automatically as dockets progress through preparation, QC review, and statutory filing.
            </p>
            <div className="reports-onboarding-card__actions">
              <Link to={ROUTES.CREATE_CASE(firmSlug)} className="reports-onboarding-btn reports-onboarding-btn--primary">
                Create First Docket
              </Link>
              <Link to={ROUTES.WORKLIST(firmSlug)} className="reports-onboarding-btn reports-onboarding-btn--secondary">
                Open Team Worklist
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Top-Level View Switcher for Admins */}
      {isAdmin && (
        <nav className="reports-tab-nav" aria-label="Reports Views">
          <button
            type="button"
            className={`reports-tab-btn ${activeTab === 'operations' ? 'reports-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('operations')}
          >
            Operational Performance
          </button>
          <button
            type="button"
            className={`reports-tab-btn ${activeTab === 'profitability' ? 'reports-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('profitability')}
          >
            Firm Effort & Profitability (Admin)
          </button>
        </nav>
      )}

      {/* TAB 1: Operational Performance */}
      {activeTab === 'operations' && (
        <>
          <div className="reports-lifecycle-grid">
            {/* Card 1: Lifecycle Distribution */}
            <div className="reports-lifecycle-card">
              <h3 className="reports-lifecycle-card__title">Docket Lifecycle Distribution</h3>
              <p className="reports-lifecycle-card__desc">Proportion of active cases across workflow stages.</p>

              <div className="reports-bar-row">
                <div className="reports-bar-header">
                  <span className="reports-bar-label">In Preparation & Drafting</span>
                  <span className="reports-bar-value">{normalized.openCases} ({calcPercent(normalized.openCases)}%)</span>
                </div>
                <div className="reports-bar-track">
                  <div className="reports-bar-fill reports-bar-fill--primary" style={{ width: `${calcPercent(normalized.openCases)}%` }} />
                </div>
              </div>

              <div className="reports-bar-row">
                <div className="reports-bar-header">
                  <span className="reports-bar-label">Pending Client Documents / Hold</span>
                  <span className="reports-bar-value">{normalized.pendedCases} ({calcPercent(normalized.pendedCases)}%)</span>
                </div>
                <div className="reports-bar-track">
                  <div className="reports-bar-fill reports-bar-fill--warning" style={{ width: `${calcPercent(normalized.pendedCases)}%` }} />
                </div>
              </div>

              <div className="reports-bar-row">
                <div className="reports-bar-header">
                  <span className="reports-bar-label">Quality Control & Senior Review</span>
                  <span className="reports-bar-value">{normalized.pendingApprovals} ({calcPercent(normalized.pendingApprovals)}%)</span>
                </div>
                <div className="reports-bar-track">
                  <div className="reports-bar-fill reports-bar-fill--neutral" style={{ width: `${calcPercent(normalized.pendingApprovals)}%` }} />
                </div>
              </div>

              <div className="reports-bar-row">
                <div className="reports-bar-header">
                  <span className="reports-bar-label">Completed & Filed</span>
                  <span className="reports-bar-value">{completedVolume} ({calcPercent(completedVolume)}%)</span>
                </div>
                <div className="reports-bar-track">
                  <div className="reports-bar-fill reports-bar-fill--success" style={{ width: `${calcPercent(completedVolume)}%` }} />
                </div>
              </div>
            </div>

            {/* Card 2: Statutory SLA & Daily Velocity */}
            <div className="reports-lifecycle-card">
              <h3 className="reports-lifecycle-card__title">Statutory SLA & Velocity Summary</h3>
              <p className="reports-lifecycle-card__desc">Compliance indicators against statutory filing deadlines.</p>

              <div className="reports-stat-list">
                <div className="reports-stat-row">
                  <span className="reports-stat-name">On-Time SLA Compliance</span>
                  <span className="reports-stat-metric">
                    <span className={`reports-stat-badge ${slaRate >= 95 ? 'reports-stat-badge--success' : slaRate >= 80 ? 'reports-stat-badge--warning' : 'reports-stat-badge--danger'}`}>
                      {slaRate}% on-time
                    </span>
                  </span>
                </div>

                <div className="reports-stat-row">
                  <span className="reports-stat-name">Critical Statutory Overdue</span>
                  <span className="reports-stat-metric">
                    {normalized.overdueCases > 0 ? (
                      <span className="reports-stat-badge reports-stat-badge--danger">{normalized.overdueCases} overdue</span>
                    ) : (
                      <span className="reports-stat-badge reports-stat-badge--success">0 overdue</span>
                    )}
                  </span>
                </div>

                <div className="reports-stat-row">
                  <span className="reports-stat-name">Today's Intake & Resolution</span>
                  <span className="reports-stat-metric">
                    +{normalized.casesCreatedToday} created · {normalized.casesResolvedToday} resolved
                  </span>
                </div>

                <div className="reports-stat-row">
                  <span className="reports-stat-name">Average Turnaround</span>
                  <span className="reports-stat-metric">
                    {avgDays > 0 ? `${avgDays} days` : 'Within statutory SLA'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Structured Operational Overview */}
          <PageSection
            title="Matter Performance Breakdown"
            description="Structured operational overview for quality audit and compliance reporting."
          >
            <DataTable
              columns={['Operational Dimension', 'Active Volume', 'Benchmark Target', 'Compliance Status']}
              rows={[
                <tr key="dim-prep">
                  <td><strong>Active Preparation</strong><br/><span className="muted">Dockets in drafting and preparation</span></td>
                  <td>{normalized.openCases} matters</td>
                  <td>&lt; 5 business days</td>
                  <td><StatusBadge status="open" label="In Progress" /></td>
                </tr>,
                <tr key="dim-pended">
                  <td><strong>Client Information Hold</strong><br/><span className="muted">Blocked waiting for client response</span></td>
                  <td>{normalized.pendedCases} matters</td>
                  <td>&lt; 48h follow-up SLA</td>
                  <td><StatusBadge status={normalized.pendedCases > 0 ? 'review' : 'closed'} label={normalized.pendedCases > 0 ? 'Follow-up Needed' : 'Normal'} /></td>
                </tr>,
                <tr key="dim-qc">
                  <td><strong>Quality Control (QC) Queue</strong><br/><span className="muted">Under review by approving partner</span></td>
                  <td>{normalized.pendingApprovals} matters</td>
                  <td>&lt; 24h approval target</td>
                  <td><StatusBadge status={normalized.pendingApprovals > 0 ? 'review' : 'closed'} label={normalized.pendingApprovals > 0 ? 'In Review' : 'Queue Clear'} /></td>
                </tr>,
                <tr key="dim-overdue">
                  <td><strong>Statutory Filing Deadlines</strong><br/><span className="muted">ROC / MCA / GST statutory dates</span></td>
                  <td>{normalized.overdueCases} matters</td>
                  <td>Zero-breach standard</td>
                  <td><StatusBadge status={normalized.overdueCases > 0 ? 'escalated' : 'closed'} label={normalized.overdueCases > 0 ? 'Breached' : 'Compliant'} /></td>
                </tr>,
                <tr key="dim-filed">
                  <td><strong>Successfully Filed & Closed</strong><br/><span className="muted">End-to-end statutory completion</span></td>
                  <td>{completedVolume} matters</td>
                  <td>Cumulative total</td>
                  <td><StatusBadge status="closed" label="Filed" /></td>
                </tr>,
              ]}
              loading={isLoading}
              error={isError ? 'Unable to load report metrics.' : ''}
              onRetry={() => void refetch()}
            />
          </PageSection>
        </>
      )}

      {/* TAB 2: Firm Effort & Profitability (Admin-Only) */}
      {isAdmin && activeTab === 'profitability' && (
        <PageSection
          title="Firm Effort & Profitability Analytics"
          description="Practice management reporting: compare logged staff hours against target budgets, analyze client concentration, and identify variance."
        >
          {/* Sub Tab Navigation */}
          <div className="reports-subtab-nav" role="tablist" aria-label="Profitability Views">
            <button
              type="button"
              className={`reports-subtab-btn ${activeReportTab === 'budget' ? 'reports-subtab-btn--active' : ''}`}
              onClick={() => setActiveReportTab('budget')}
              role="tab"
              aria-selected={activeReportTab === 'budget'}
            >
              Budget vs Actual
            </button>
            <button
              type="button"
              className={`reports-subtab-btn ${activeReportTab === 'clients' ? 'reports-subtab-btn--active' : ''}`}
              onClick={() => setActiveReportTab('clients')}
              role="tab"
              aria-selected={activeReportTab === 'clients'}
            >
              Client Effort Footprint
            </button>
            <button
              type="button"
              className={`reports-subtab-btn ${activeReportTab === 'variance' ? 'reports-subtab-btn--active' : ''}`}
              onClick={() => setActiveReportTab('variance')}
              role="tab"
              aria-selected={activeReportTab === 'variance'}
            >
              Service-Line Variance
            </button>
          </div>

          {/* Sub Tab 1: Budget vs Actual Table */}
          {activeReportTab === 'budget' && (
            <DataTable
              columns={['Docket ID', 'Description', 'Client', 'Target Budget', 'Actual Cost', 'Cost Variance', 'Expected Mins', 'Actual Mins', 'Time Variance']}
              rows={(profitabilityReport?.budgetVsActual || []).map((row, idx) => {
                const costVarianceIsNegative = row.costVariance < 0;
                const timeVarianceIsNegative = row.timeVariance < 0;
                return (
                  <tr key={`${row.caseId}-${idx}`}>
                    <td><strong>{row.caseId}</strong></td>
                    <td style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.title}</td>
                    <td>{row.clientId || '—'}</td>
                    <td>₹{Number(row.estimatedBudget || 0).toLocaleString('en-IN')}</td>
                    <td>₹{Number(row.actualCost || 0).toLocaleString('en-IN')}</td>
                    <td>
                      <span className={`reports-stat-badge ${costVarianceIsNegative ? 'reports-stat-badge--success' : row.costVariance > 0 ? 'reports-stat-badge--danger' : ''}`}>
                        {row.costVariance > 0 ? `+₹${row.costVariance}` : row.costVariance < 0 ? `-₹${Math.abs(row.costVariance)}` : '₹0'}
                      </span>
                    </td>
                    <td>{row.expectedMinutes || 0}m</td>
                    <td>{row.actualMinutes || 0}m</td>
                    <td>
                      <span className={`reports-stat-badge ${timeVarianceIsNegative ? 'reports-stat-badge--success' : row.timeVariance > 0 ? 'reports-stat-badge--danger' : ''}`}>
                        {row.timeVariance > 0 ? `+${row.timeVariance}m` : row.timeVariance < 0 ? `-${Math.abs(row.timeVariance)}m` : '0m'}
                      </span>
                    </td>
                  </tr>
                );
              })}
              loading={profitabilityReportLoading}
              emptyLabel="No time logs or target budgets recorded for recurring obligations yet."
            />
          )}

          {/* Sub Tab 2: Client Footprint */}
          {activeReportTab === 'clients' && (
            <DataTable
              columns={['Client ID / Code', 'Total Time Logged', 'Filing Time Entries Count']}
              rows={(profitabilityReport?.clientSummary || []).map((row, idx) => (
                <tr key={`${row.clientId}-${idx}`}>
                  <td><strong>{row.clientId}</strong></td>
                  <td style={{ fontWeight: '600', color: '#4f46e5' }}>{row.totalMinutes} minutes</td>
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
              rows={(profitabilityReport?.obligationVariance || []).map((row, idx) => {
                const isOverBudget = row.varianceMinutes > 0;
                return (
                  <tr key={`${row.serviceLine}-${idx}`}>
                    <td style={{ fontWeight: '600', textTransform: 'capitalize' }}>{row.serviceLine.replace(/_/g, ' ')}</td>
                    <td>{row.docketsCount}</td>
                    <td>{row.totalExpected}m</td>
                    <td>{row.totalActual}m</td>
                    <td>
                      <span className={`reports-stat-badge ${isOverBudget ? 'reports-stat-badge--danger' : row.varianceMinutes < 0 ? 'reports-stat-badge--success' : ''}`}>
                        {row.varianceMinutes > 0 ? `+${row.varianceMinutes}m` : row.varianceMinutes < 0 ? `-${Math.abs(row.varianceMinutes)}m` : '0m'}
                      </span>
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
