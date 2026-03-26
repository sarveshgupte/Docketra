/**
 * Dashboard Page
 * 
 * Enterprise B2B SaaS dashboard for Indian professional firms.
 * Section 1: KPI Strip (4 large metric cards)
 * Section 2: Case Workflow Summary (status pipeline)
 * Section 3: Recent Cases worklist panel
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/common/Layout';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { DashboardSkeleton, SkeletonBlock } from '../components/common/Skeleton';
import { EmptyState } from '../components/layout/EmptyState';
import { PageHeader } from '../components/layout/PageHeader';
import { PriorityPill } from '../components/common/PriorityPill';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/common/Table';
import { SetupChecklist } from '../components/onboarding/SetupChecklist';
import { MetricCard } from '../components/reports/MetricCard';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { caseService } from '../services/caseService';
import { worklistService } from '../services/worklistService';
import { adminService } from '../services/adminService';
import { clientService } from '../services/clientService';
import { metricsService } from '../services/metricsService';
import { formatDate } from '../utils/formatters';
import { getStatusLabel } from '../utils/statusDisplay';
import { UX_COPY } from '../constants/uxCopy';
import api from '../services/api';

const DASHBOARD_RECENT_CASES_ROW_COUNT = 5;
const DASHBOARD_RECENT_CASES_MAX_ROWS = 10;
const DASHBOARD_RECENT_CASES_LIMIT = Math.min(DASHBOARD_RECENT_CASES_ROW_COUNT, DASHBOARD_RECENT_CASES_MAX_ROWS);

const getCaseTimestamp = (caseItem) => {
  const timestamp = new Date(caseItem?.updatedAt || caseItem?.createdAt || '').getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
};

const getRecentCasesSnapshot = (cases = []) =>
  [...cases]
    .sort((firstCase, secondCase) => {
      const firstTimestamp = getCaseTimestamp(firstCase);
      const secondTimestamp = getCaseTimestamp(secondCase);
      return secondTimestamp - firstTimestamp;
    })
    .slice(0, DASHBOARD_RECENT_CASES_LIMIT);

export const DashboardPage = () => {
  const { user } = useAuth();
  const { isAdmin } = usePermissions();
  const isEmployee = user?.role === 'Employee';
  const navigate = useNavigate();
  const { firmSlug } = useParams();
  
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    myOpenCases: 0,
    myPendingCases: 0,
    myResolvedCases: 0,
    myUnassignedCreatedCases: 0,
    adminPendingApprovals: 0,
    adminFiledCases: 0,
    adminResolvedCases: 0,
    activeClients: 0,
    overdueComplianceItems: 0,
    dueInSevenDays: 0,
    awaitingPartnerReview: 0,
    totalOpenCases: 0,
    totalExecutedCases: 0,
  });
  const [recentCases, setRecentCases] = useState([]);
  const [recentCasesLoading, setRecentCasesLoading] = useState(true);
  const [showBookmarkPrompt, setShowBookmarkPrompt] = useState(false);
  const [loadWarnings, setLoadWarnings] = useState([]);
  const [hasLoadedDashboard, setHasLoadedDashboard] = useState(false);

  const reportLoadWarning = (message) => {
    setLoadWarnings((current) => (current.includes(message) ? current : [...current, message]));
  };

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user, isAdmin]);

  // Show bookmark prompt only after dashboard loading completes
  useEffect(() => {
    if (loading) return;
    if (user?.xID && isAdmin && firmSlug) {
      const hasSeenBookmarkPrompt = localStorage.getItem(`bookmarkPrompt_${user.xID}`);
      if (!hasSeenBookmarkPrompt) {
        setShowBookmarkPrompt(true);
      }
    }
  }, [loading, user, isAdmin, firmSlug]);

  const handleDismissBookmarkPrompt = () => {
    setShowBookmarkPrompt(false);
    if (user?.xID) {
      localStorage.setItem(`bookmarkPrompt_${user.xID}`, 'true');
    }
  };

  const loadDashboardData = async () => {
    if (!hasLoadedDashboard) {
      setLoading(true);
    }

    setRecentCasesLoading(true);
    setLoadWarnings([]);
    try {
      const userFirmId = user?.firmId || user?.firm?.id;
      const fetchStatSafely = async (request, mapResponse, errorMessage, warningMessage) => {
        try {
          const response = await request();
          return mapResponse(response);
        } catch (error) {
          console.error(errorMessage, error);
          reportLoadWarning(warningMessage);
          return {};
        }
      };

      const recentCasesPromise = (async () => {
        try {
          if (isAdmin) {
            const casesResponse = await caseService.getCases({ limit: DASHBOARD_RECENT_CASES_LIMIT });
            return casesResponse.success ? (casesResponse.data || []) : [];
          }

          const worklistResponse = await worklistService.getEmployeeWorklist({ limit: DASHBOARD_RECENT_CASES_LIMIT });
          return worklistResponse.success ? (worklistResponse.data || []) : [];
        } catch (error) {
          console.error(isAdmin ? 'Failed to load firm cases:' : 'Failed to load worklist:', error);
          reportLoadWarning('Recent cases');
          return [];
        }
      })();

      const [
        casesToDisplay,
        metricsPatch,
        openCasesPatch,
        pendingCasesPatch,
        resolvedCasesPatch,
        unassignedCasesPatch,
        adminPendingApprovalsPatch,
        adminFiledCasesPatch,
        adminResolvedCasesPatch,
        activeClientsPatch,
      ] = await Promise.all([
        recentCasesPromise,
        userFirmId
          ? fetchStatSafely(
            () => metricsService.getFirmMetrics(userFirmId),
            (metricsResponse) => (metricsResponse.success ? (metricsResponse.data || {}) : {}),
            'Failed to load firm metrics:',
            'Firm metrics',
          )
          : Promise.resolve({}),
        fetchStatSafely(
          () => worklistService.getEmployeeWorklist(),
          (worklistResponse) => (worklistResponse.success ? { myOpenCases: (worklistResponse.data || []).length } : {}),
          'Failed to load open cases count:',
          'Open case counts',
        ),
        fetchStatSafely(
          () => api.get('/cases/my-pending'),
          (pendingResponse) => (pendingResponse.data.success ? { myPendingCases: (pendingResponse.data.data || []).length } : {}),
          'Failed to load pending cases:',
          'Pending case counts',
        ),
        fetchStatSafely(
          () => caseService.getMyResolvedCases(),
          (resolvedResponse) => (resolvedResponse.success ? { myResolvedCases: (resolvedResponse.data || []).length } : {}),
          'Failed to load resolved cases:',
          'Resolved case counts',
        ),
        fetchStatSafely(
          () => caseService.getMyUnassignedCreatedCases(),
          (unassignedCreatedResponse) => (
            unassignedCreatedResponse.success
              ? { myUnassignedCreatedCases: (unassignedCreatedResponse.data || []).length }
              : {}
          ),
          'Failed to load unassigned created cases:',
          'Unassigned case counts',
        ),
        isAdmin
          ? fetchStatSafely(
            () => adminService.getPendingApprovals(),
            (approvalsResponse) => (
              approvalsResponse.success ? { adminPendingApprovals: approvalsResponse.data?.length || 0 } : {}
            ),
            'Failed to load pending approvals:',
            'Pending approvals',
          )
          : Promise.resolve({}),
        isAdmin
          ? fetchStatSafely(
            () => api.get('/admin/cases/filed'),
            (filedResponse) => (
              filedResponse.data.success ? { adminFiledCases: filedResponse.data.pagination?.total || 0 } : {}
            ),
            'Failed to load filed cases:',
            'Filed cases',
          )
          : Promise.resolve({}),
        isAdmin
          ? fetchStatSafely(
            () => adminService.getAllResolvedCases(),
            (adminResolvedResponse) => (
              adminResolvedResponse.success
                ? { adminResolvedCases: adminResolvedResponse.pagination?.total || 0 }
                : {}
            ),
            'Failed to load admin resolved cases:',
            'Resolved admin cases',
          )
          : Promise.resolve({}),
        isAdmin
          ? fetchStatSafely(
            () => clientService.getClients(true),
            (clientsResponse) => (clientsResponse.success ? { activeClients: (clientsResponse.data || []).length } : {}),
            'Failed to load active clients:',
            'Client counts',
          )
          : Promise.resolve({}),
      ]);

      setRecentCases(getRecentCasesSnapshot(casesToDisplay));
      const statsPatch = {
        ...metricsPatch,
        ...openCasesPatch,
        ...pendingCasesPatch,
        ...resolvedCasesPatch,
        ...unassignedCasesPatch,
        ...adminPendingApprovalsPatch,
        ...adminFiledCasesPatch,
        ...adminResolvedCasesPatch,
        ...activeClientsPatch,
      };
      setStats((prev) => ({ ...prev, ...statsPatch }));
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      reportLoadWarning('Dashboard data');
    } finally {
      setRecentCasesLoading(false);
      setLoading(false);
      setHasLoadedDashboard(true);
    }
  };

  const handleCaseClick = (caseId) => {
    navigate(`/app/firm/${firmSlug}/cases/${caseId}`);
  };

  const handleViewAllCases = () => {
    navigate(`/app/firm/${firmSlug}/cases`);
  };

  const handleChecklistAction = (stepId) => {
    if (stepId === 'create-case') {
      navigate(`/app/firm/${firmSlug}/cases/create`);
      return;
    }

    if (stepId === 'assign-owner') {
      navigate(`/app/firm/${firmSlug}/cases`);
      return;
    }

    if (stepId === 'invite-team') {
      navigate(`/app/firm/${firmSlug}/admin`);
      return;
    }

    if (stepId === 'configure-firm') {
      navigate(`/app/firm/${firmSlug}/settings/firm`);
    }
  };

  if (loading) {
    return (
      <Layout>
        <DashboardSkeleton />
      </Layout>
    );
  }

  const awaitingPartnerReview = stats.awaitingPartnerReview;

  // Workflow status pipeline data
  const workflowStatuses = [
    { label: UX_COPY.statusLabels.OPEN, count: stats.myOpenCases, color: 'var(--color-primary)' },
    { label: UX_COPY.statusLabels.PENDED, count: stats.myPendingCases, color: 'var(--warning)' },
    { label: UX_COPY.statusLabels.RESOLVED, count: stats.myResolvedCases, color: 'var(--color-success)' },
    { label: 'Unassigned', count: stats.myUnassignedCreatedCases, color: 'var(--text-muted)' },
  ];

  const kpiCards = [
    {
      title: 'Overdue Compliance Items',
      value: stats.overdueComplianceItems,
      subtitle: 'Red Risk Band',
      subtitleClassName: 'text-red-600',
      onClick: () => navigate(`/app/firm/${firmSlug}/my-worklist?status=OPEN`),
    },
    {
      title: 'Due in 7 Days',
      value: stats.dueInSevenDays,
      subtitle: 'Amber Risk Band',
      subtitleClassName: 'text-amber-600',
      onClick: () => navigate(`/app/firm/${firmSlug}/cases?approvalStatus=PENDING`),
    },
    {
      title: 'Awaiting Partner Review',
      value: awaitingPartnerReview,
      subtitle: 'Approval queue',
      onClick: () => navigate(`/app/firm/${firmSlug}/my-worklist?status=PENDED`),
    },
    isAdmin
      ? {
          title: 'Active Reporting Entities',
          value: stats.activeClients,
          subtitle: 'Total active reporting entities',
          subtitleClassName: 'text-green-600',
          onClick: () => navigate(`/app/firm/${firmSlug}/admin`),
        }
      : {
          title: 'Risk Summary Panel',
          value: stats.myResolvedCases,
          subtitle: 'Executed compliance items',
          subtitleClassName: 'text-green-600',
          onClick: () => navigate(`/app/firm/${firmSlug}/my-worklist?status=RESOLVED`),
        },
  ];

  const adminStatCards = [
    {
      title: 'Filed Cases',
      value: stats.adminFiledCases,
      subtitle: 'Archived cases',
      onClick: () => navigate(`/app/firm/${firmSlug}/cases?status=FILED`),
    },
    {
      title: 'All Resolved',
      value: stats.adminResolvedCases,
      subtitle: 'All executed cases',
      onClick: () => navigate(`/app/firm/${firmSlug}/cases?status=RESOLVED`),
    },
    {
      title: 'Unassigned',
      value: stats.myUnassignedCreatedCases,
      subtitle: 'Needs assignment',
      onClick: () => navigate(`/app/firm/${firmSlug}/global-worklist?createdBy=me&status=UNASSIGNED`),
    },
  ];

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          <PageHeader
            title="Partner Control Dashboard"
            description="Where is the compliance risk in my firm today?"
            actions={(
              <Button variant="primary" onClick={() => navigate(`/app/firm/${firmSlug}/cases/create`)}>
                {UX_COPY.actions.CREATE_CASE}
              </Button>
            )}
          />

          {isAdmin && user?.xID && firmSlug ? (
            <SetupChecklist
              storageKey={`setupChecklist:${user.xID}:${firmSlug}`}
              recentCases={recentCases}
              onAction={handleChecklistAction}
            />
          ) : null}

          {loadWarnings.length ? (
            <div
              className="flex flex-col gap-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-gray-900 sm:flex-row sm:items-center sm:justify-between"
              role="status"
              aria-live="polite"
            >
              <div>
                <strong>Some dashboard data could not be loaded.</strong>
                <p className="mt-1 text-sm text-gray-600">
                  Metrics may be incomplete right now. Retry to refresh the latest workload and compliance signals.
                </p>
              </div>
              <Button variant="outline" onClick={loadDashboardData}>
                Retry
              </Button>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {kpiCards.map((card) => (
              <MetricCard
                key={card.title}
                title={card.title}
                value={card.value}
                subtitle={card.subtitle}
                subtitleClassName={card.subtitleClassName}
                onClick={card.onClick}
              />
            ))}
          </div>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 tracking-tight">Docket Lifecycle Distribution</h2>
            <Card className="p-6">
              <div className="flex flex-wrap items-center gap-4 lg:flex-nowrap">
                {workflowStatuses.map((item, idx) => (
                  <React.Fragment key={item.label}>
                    <div className="flex min-w-[96px] flex-1 flex-col items-center gap-2 text-center">
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-full border-2 bg-gray-50 text-base font-bold"
                        style={{ color: item.color, borderColor: item.color }}
                      >
                        {item.count}
                      </div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">{item.label}</div>
                    </div>
                    {idx < workflowStatuses.length - 1 ? (
                      <div className="hidden text-xl text-gray-300 lg:block">›</div>
                    ) : null}
                  </React.Fragment>
                ))}
              </div>
            </Card>
          </section>

          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-gray-900 tracking-tight">Recent Dockets</h2>
              <Button variant="outline" onClick={handleViewAllCases}>
                View All Dockets
              </Button>
            </div>
            <Card className="p-0">
              {recentCasesLoading ? (
                <div className="grid gap-3 p-6" aria-busy="true" aria-live="polite">
                  {Array.from({ length: DASHBOARD_RECENT_CASES_LIMIT }).map((_, index) => (
                    <div
                      key={index}
                      className="grid items-center gap-3 min-[720px]:grid-cols-[minmax(180px,2fr)_repeat(4,minmax(96px,1fr))]"
                    >
                      <SkeletonBlock style={{ width: '100%', height: '14px' }} />
                      <SkeletonBlock style={{ width: '80%', height: '14px' }} />
                      <SkeletonBlock style={{ width: '72%', height: '14px' }} />
                      <SkeletonBlock style={{ width: '64%', height: '14px' }} />
                      <SkeletonBlock style={{ width: '58%', height: '14px' }} />
                    </div>
                  ))}
                </div>
              ) : recentCases.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    title={isAdmin ? 'No dockets yet' : 'No assigned dockets yet'}
                    description={
                      isAdmin
                        ? 'Create your first docket to start tracking deadlines, ownership, and firm workflow health.'
                        : 'Once work is assigned to you, your recently updated dockets will appear here for quick follow-up.'
                    }
                    actionLabel={UX_COPY.actions.CREATE_CASE}
                    onAction={() => navigate(`/app/firm/${firmSlug}/cases/create`)}
                  />
                </div>
              ) : (
                <Table className="border-0 rounded-none shadow-none">
                  <TableHead>
                    <tr>
                      <TableHeader className="w-full max-w-lg">Docket Name</TableHeader>
                      <TableHeader className="w-[1px] whitespace-nowrap">Category</TableHeader>
                      <TableHeader className="w-[1px] whitespace-nowrap text-center">Status</TableHeader>
                      <TableHeader className="w-[1px] whitespace-nowrap text-center">Priority</TableHeader>
                      <TableHeader className="w-[1px] whitespace-nowrap text-right">Last Action Timestamp</TableHeader>
                    </tr>
                  </TableHead>
                  <TableBody>
                    {recentCases.map((caseItem) => (
                      <TableRow
                        key={caseItem._id}
                        onClick={() => handleCaseClick(caseItem.caseId)}
                        className="focus-within:bg-gray-50"
                      >
                        <TableCell className="w-full max-w-lg">
                          <span className="block overflow-hidden text-ellipsis whitespace-nowrap" title={caseItem.caseName}>
                            {caseItem.caseName}
                          </span>
                        </TableCell>
                        <TableCell className="w-[1px] whitespace-nowrap">{caseItem.category}</TableCell>
                        <TableCell className="w-[1px] whitespace-nowrap text-center">
                          <Badge status={caseItem.status}>{getStatusLabel(caseItem.status)}</Badge>
                        </TableCell>
                        <TableCell className="w-[1px] whitespace-nowrap text-center"><PriorityPill caseRecord={caseItem} /></TableCell>
                        <TableCell className="w-[1px] whitespace-nowrap text-right tabular-nums">{formatDate(caseItem.updatedAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </section>

          {isAdmin ? (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 tracking-tight">Execution Status by Team Member</h2>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {adminStatCards.map((card) => (
                  <MetricCard
                    key={card.title}
                    title={card.title}
                    value={card.value}
                    subtitle={card.subtitle}
                    onClick={card.onClick}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>

      {showBookmarkPrompt ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900 tracking-tight">Bookmark Your Firm Dashboard</h2>
            <p className="mt-3 text-sm text-gray-600">
              For quick access in the future, we recommend bookmarking this page:
            </p>
            <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 font-mono text-xs text-gray-700 break-all">
              {window.location.origin}/app/firm/{firmSlug}
            </div>
            <button className="btn btn-primary mt-5 w-full" onClick={handleDismissBookmarkPrompt}>
              Got it
            </button>
          </div>
        </div>
      ) : null}
    </Layout>
  );
};
