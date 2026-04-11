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
import { createPortal } from 'react-dom';
import { Layout } from '../components/common/Layout';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { DashboardSkeleton, SkeletonBlock } from '../components/common/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/layout/PageHeader';
import { PriorityPill } from '../components/common/PriorityPill';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/common/Table';
import { SetupChecklist } from '../components/onboarding/SetupChecklist';
import { MetricCard } from '../components/reports/MetricCard';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { caseApi } from '../api/case.api';
import { worklistApi } from '../api/worklist.api';
import { adminApi } from '../api/admin.api';
import { clientApi } from '../api/client.api';
import { metricsApi } from '../api/metrics.api';
import { NotificationPanel } from '../../components/NotificationPanel';
import { formatCaseName, formatDate } from '../utils/formatters';
import { getStatusLabel } from '../utils/statusDisplay';
import { UX_COPY } from '../constants/uxCopy';
import { ROUTES, safeRoute } from '../constants/routes';
import { useActiveDocket } from '../hooks/useActiveDocket';

const DASHBOARD_RECENT_CASES_ROW_COUNT = 5;
const DASHBOARD_RECENT_CASES_MAX_ROWS = 10;
const DASHBOARD_RECENT_CASES_LIMIT = Math.min(DASHBOARD_RECENT_CASES_ROW_COUNT, DASHBOARD_RECENT_CASES_MAX_ROWS);
const resolveSupportEmail = () => {
  const rawMailFrom = String(import.meta.env.VITE_MAIL_FROM || import.meta.env.MAIL_FROM || '').trim();
  if (!rawMailFrom) return 'support@docketra.com';

  const bracketMatch = rawMailFrom.match(/<([^>]+)>/);
  const candidate = (bracketMatch?.[1] || rawMailFrom).trim();
  return candidate.includes('@') ? candidate : 'support@docketra.com';
};

const DEFAULT_SUPPORT_EMAIL = resolveSupportEmail();

const ADMIN_PRODUCT_TOUR_STEPS = [
  {
    title: 'Add your first client',
    description: 'Start by creating a client profile so every docket, document, and workflow has a clear reporting entity.',
  },
  {
    title: 'Invite your team members',
    description: 'Go to Admin and add users so work can be delegated, reviewed, and tracked across partners and employees.',
  },
  {
    title: 'Configure docket categories',
    description: 'Create categories and subcategories to standardize your docket types and simplify filtering and reporting.',
  },
  {
    title: 'Create your first docket',
    description: 'Set up a docket with owner, due date, and priority so the team can begin execution immediately.',
  },
  {
    title: 'Use Workbasket for firm-level triage',
    description: 'Review newly created and unassigned dockets in Workbasket to plan ownership and execution order.',
  },
  {
    title: 'Pull docket from Workbasket to Worklist',
    description: 'Assign ownership and move dockets into Worklist for day-to-day action, status updates, and completion.',
  },
];

const USER_PRODUCT_TOUR_STEPS = [
  {
    title: 'Review your assigned worklist',
    description: 'Open My WL to see the dockets assigned to you and identify what needs action first.',
  },
  {
    title: 'Create your first docket',
    description: 'Create a docket with due date, category, and priority so your team can begin tracking execution.',
  },
  {
    title: 'Update docket progress',
    description: 'Move dockets through statuses (open, in review, resolved) to keep timelines and compliance signals accurate.',
  },
  {
    title: 'Use Workbasket for intake visibility',
    description: 'Monitor incoming or unassigned dockets in Workbasket and coordinate with admins for ownership assignment.',
  },
  {
    title: 'Track risk and due dates daily',
    description: 'Use the KPI cards on this dashboard every day to prioritize overdue and upcoming compliance items.',
  },
];

const ADMIN_FAQ_ITEMS = [
  {
    question: 'How do I set up Docketra for a new firm?',
    answer: 'Follow this sequence: add a client, invite users, define categories, create your first docket, then route it via Workbasket to Worklist.',
  },
  {
    question: 'What is the difference between Workbasket and Worklist?',
    answer: 'Workbasket is the firm-level intake and triage area; Worklist is the execution queue where assigned users do actual task follow-up.',
  },
  {
    question: 'Why should we use categories before creating many dockets?',
    answer: 'Categories ensure consistent naming, smarter filtering, cleaner reporting, and lower operational confusion as docket volume grows.',
  },
  {
    question: 'Can we replay the guided tour later?',
    answer: 'Yes. Use the "Replay product tour" button in the Help & Onboarding section on this dashboard anytime.',
  },
];

const USER_FAQ_ITEMS = [
  {
    question: 'How should a USER start using Docketra on first login?',
    answer: 'Start with My WL, review assigned dockets, and prioritize overdue or near-due items for immediate follow-up.',
  },
  {
    question: 'Can a USER add clients or invite team members?',
    answer: 'No. USER accounts focus on docket execution. Client and team setup actions are available to admin roles only.',
  },
  {
    question: 'What should I do if a docket is unassigned?',
    answer: 'Use Workbasket to identify the docket and coordinate with your admin for assignment before execution.',
  },
  {
    question: 'Can I replay this tutorial later?',
    answer: 'Yes. Use the "Replay product tour" button in the Help & Onboarding section at any time.',
  },
];

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

const formatDocketIdentifier = (caseItem = {}) => {
  const raw = String(caseItem.caseId || caseItem.caseNumber || '').trim();
  if (raw) {
    return raw.replace(/^CASE-/i, 'DOCKET-');
  }
  const caseName = formatCaseName(caseItem.caseName);
  return caseName && caseName !== 'N/A' ? caseName : 'DOCKET-UNKNOWN';
};

const formatAssignmentLabel = (caseItem = {}) => {
  const explicit = [caseItem.assignedToName, caseItem.assignedToXID, caseItem.assignedTo]
    .map((value) => (value == null ? '' : String(value).trim()))
    .find(Boolean);

  if (explicit) return explicit;
  return 'Unassigned';
};

export const DashboardPage = () => {
  const { user } = useAuth();
  const { isAdmin } = usePermissions();
  const navigate = useNavigate();
  const { firmSlug } = useParams();
  const { openDocket } = useActiveDocket();
  const productTourSteps = isAdmin ? ADMIN_PRODUCT_TOUR_STEPS : USER_PRODUCT_TOUR_STEPS;
  const faqItems = isAdmin ? ADMIN_FAQ_ITEMS : USER_FAQ_ITEMS;
  
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
  const [showProductTour, setShowProductTour] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);
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

  useEffect(() => {
    if (!firmSlug) {
      navigate('/superadmin', { replace: true });
    }
  }, [firmSlug, navigate]);

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

  useEffect(() => {
    if (loading || !user?.xID || !firmSlug) return;
    const tourCompletedKey = `productTourCompleted:${user.xID}:${firmSlug}`;
    const hasCompletedTour = localStorage.getItem(tourCompletedKey) === 'true';
    if (!hasCompletedTour) {
      setTourStepIndex(0);
      setShowProductTour(true);
    }
  }, [loading, user, firmSlug]);

  useEffect(() => {
    if (!showProductTour && !showBookmarkPrompt) return undefined;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [showProductTour, showBookmarkPrompt]);

  const handleDismissBookmarkPrompt = () => {
    setShowBookmarkPrompt(false);
    if (user?.xID) {
      localStorage.setItem(`bookmarkPrompt_${user.xID}`, 'true');
    }
  };

  const markTourCompleted = () => {
    if (user?.xID && firmSlug) {
      localStorage.setItem(`productTourCompleted:${user.xID}:${firmSlug}`, 'true');
    }
    setShowProductTour(false);
    setTourStepIndex(0);
  };

  const handleTourNext = () => {
    setTourStepIndex((currentStep) => {
      if (currentStep >= productTourSteps.length - 1) {
        markTourCompleted();
        return currentStep;
      }
      return currentStep + 1;
    });
  };

  const handleReplayTour = () => {
    setTourStepIndex(0);
    setShowProductTour(true);
  };

  const loadDashboardData = async () => {
    if (!hasLoadedDashboard) {
      setLoading(true);
    }

    setRecentCasesLoading(true);
    setLoadWarnings([]);
    try {
      const firmIdCandidates = [
        user?.firmId,
        user?.firm?.id,
        user?.firm?._id,
      ]
        .map((value) => (typeof value === 'string' ? value.trim() : value))
        .filter(Boolean);
      const [userFirmId] = [...new Set(firmIdCandidates)];

      const fetchFirmMetrics = async (firmId) => {
        if (!firmId) {
          return {};
        }

        const firmMetricsCandidates = [firmId, ...firmIdCandidates.filter((candidate) => candidate !== firmId)];
        let lastError = null;

        for (const candidateFirmId of firmMetricsCandidates) {
          try {
            const metricsResponse = await metricsApi.getFirmMetrics(candidateFirmId);
            if (metricsResponse.success) {
              return metricsResponse.data || {};
            }
          } catch (error) {
            lastError = error;
          }
        }

        if (lastError) {
          throw lastError;
        }

        return {};
      };

      const fetchStatSafely = async (
        request,
        mapResponse,
        errorMessage,
        warningMessage,
        { showWarning = false } = {},
      ) => {
        try {
          const response = await request();
          return mapResponse(response);
        } catch (error) {
          console.error(errorMessage, error);
          if (showWarning) {
            reportLoadWarning(warningMessage);
          }
          return {};
        }
      };

      const recentCasesPromise = (async () => {
        try {
          if (isAdmin) {
            const casesResponse = await caseApi.getCases({ limit: DASHBOARD_RECENT_CASES_LIMIT });
            return casesResponse.success ? (casesResponse.data || []) : [];
          }

          const worklistResponse = await worklistApi.getEmployeeWorklist({ limit: DASHBOARD_RECENT_CASES_LIMIT });
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
            () => fetchFirmMetrics(userFirmId),
            (metricsResponse) => metricsResponse,
            'Failed to load firm metrics:',
            'Firm metrics',
            { showWarning: true },
          )
          : Promise.resolve({}),
        fetchStatSafely(
          () => worklistApi.getEmployeeWorklist(),
          (worklistResponse) => (worklistResponse.success ? { myOpenCases: (worklistResponse.data || []).length } : {}),
          'Failed to load open cases count:',
          'Open case counts',
        ),
        fetchStatSafely(
          () => caseApi.getMyPendingCases(),
          (pendingResponse) => (pendingResponse.success ? { myPendingCases: (pendingResponse.data || []).length } : {}),
          'Failed to load pending cases:',
          'Pending case counts',
        ),
        fetchStatSafely(
          () => caseApi.getMyResolvedCases(),
          (resolvedResponse) => (resolvedResponse.success ? { myResolvedCases: (resolvedResponse.data || []).length } : {}),
          'Failed to load resolved cases:',
          'Resolved case counts',
        ),
        fetchStatSafely(
          () => caseApi.getMyUnassignedCreatedCases(),
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
            () => adminApi.getPendingApprovals(),
            (approvalsResponse) => (
              approvalsResponse.success ? { adminPendingApprovals: approvalsResponse.data?.length || 0 } : {}
            ),
            'Failed to load pending approvals:',
            'Pending approvals',
          )
          : Promise.resolve({}),
        isAdmin
          ? fetchStatSafely(
            () => caseApi.getAdminFiledCases(),
            (filedResponse) => (
              filedResponse.success ? { adminFiledCases: filedResponse.pagination?.total || 0 } : {}
            ),
            'Failed to load filed cases:',
            'Filed cases',
          )
          : Promise.resolve({}),
        isAdmin
          ? fetchStatSafely(
            () => adminApi.getAllResolvedCases(),
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
            () => clientApi.getClients(true),
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
    openDocket({ caseId, navigate, to: safeRoute(ROUTES.CASE_DETAIL(firmSlug, caseId)) });
  };

  const handleChecklistAction = (stepId) => {
    if (stepId === 'create-case') {
      navigate(safeRoute(ROUTES.CREATE_CASE(firmSlug)));
      return;
    }

    if (stepId === 'assign-owner') {
      navigate(safeRoute(ROUTES.CASES(firmSlug)));
      return;
    }

    if (stepId === 'invite-team') {
      navigate(safeRoute(ROUTES.ADMIN(firmSlug)));
      return;
    }

    if (stepId === 'configure-firm') {
      navigate(safeRoute(ROUTES.FIRM_SETTINGS(firmSlug)));
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
    { label: UX_COPY.statusLabels.PENDING, count: stats.myPendingCases, color: 'var(--warning)' },
    { label: UX_COPY.statusLabels.RESOLVED, count: stats.myResolvedCases, color: 'var(--color-success)' },
    { label: 'Unassigned', count: stats.myUnassignedCreatedCases, color: 'var(--text-muted)' },
  ];

  const kpiCards = [
    {
      title: 'Overdue Compliance Items',
      value: stats.overdueComplianceItems,
      subtitle: 'Red Risk Band',
      subtitleClassName: 'text-red-600',
      onClick: () => navigate(`${safeRoute(ROUTES.MY_WORKLIST(firmSlug))}?status=OPEN`),
    },
    {
      title: 'Due in 7 Days',
      value: stats.dueInSevenDays,
      subtitle: 'Amber Risk Band',
      subtitleClassName: 'text-amber-600',
      onClick: () => navigate(`${safeRoute(ROUTES.CASES(firmSlug))}?approvalStatus=PENDING`),
    },
    {
      title: isAdmin ? 'Awaiting Partner Review' : 'Awaiting My Review',
      value: awaitingPartnerReview,
      subtitle: 'Approval queue',
      onClick: () => navigate(`${safeRoute(ROUTES.MY_WORKLIST(firmSlug))}?status=PENDING`),
    },
    isAdmin
      ? {
          title: 'Active Reporting Entities',
          value: stats.activeClients,
          subtitle: 'Total active reporting entities',
          subtitleClassName: 'text-green-600',
          onClick: () => navigate(safeRoute(ROUTES.ADMIN(firmSlug))),
        }
      : {
          title: 'Risk Summary Panel',
          value: stats.myResolvedCases,
          subtitle: 'Executed compliance items',
          subtitleClassName: 'text-green-600',
          onClick: () => navigate(`${safeRoute(ROUTES.MY_WORKLIST(firmSlug))}?status=RESOLVED`),
        },
  ];

  const adminStatCards = [
    {
      title: 'Filed Dockets',
      value: stats.adminFiledCases,
      subtitle: 'Archived dockets',
      onClick: () => navigate(`${safeRoute(ROUTES.CASES(firmSlug))}?status=FILED`),
    },
    {
      title: 'All Resolved',
      value: stats.adminResolvedCases,
      subtitle: 'All executed dockets',
      onClick: () => navigate(`${safeRoute(ROUTES.CASES(firmSlug))}?status=RESOLVED`),
    },
    {
      title: 'Unassigned',
      value: stats.myUnassignedCreatedCases,
      subtitle: 'Needs assignment',
      onClick: () => navigate(`${safeRoute(ROUTES.GLOBAL_WORKLIST(firmSlug))}?createdBy=me&status=UNASSIGNED`),
    },
  ];

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          <PageHeader
            title={isAdmin ? 'Partner Control Dashboard' : 'User Work Dashboard'}
            description={
              isAdmin
                ? 'Where is the compliance risk in my firm today?'
                : 'What should I work on first today?'
            }
            actions={(
              <Button variant="primary" onClick={() => navigate(safeRoute(ROUTES.CREATE_CASE(firmSlug)))}>
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
            <Card>
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <h2 className="text-lg font-semibold text-gray-900 tracking-tight">Recent Dockets</h2>
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
                    actionLabel={isAdmin ? UX_COPY.actions.CREATE_CASE : undefined}
                    onAction={isAdmin ? () => navigate(safeRoute(ROUTES.CREATE_CASE(firmSlug))) : undefined}
                  />
                </div>
              ) : (
                <Table className="border-0 rounded-none shadow-none">
                  <TableHead>
                    <tr>
                      <TableHeader className="w-full max-w-lg">Docket Name</TableHeader>
                      <TableHeader className="w-[1px] whitespace-nowrap">Category</TableHeader>
                      <TableHeader className="w-[1px] whitespace-nowrap">Assigned To</TableHeader>
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
                          <div className="flex flex-col">
                            <span className="block overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-gray-900" title={formatDocketIdentifier(caseItem)}>
                              {formatDocketIdentifier(caseItem)}
                            </span>
                            {caseItem.title ? (
                              <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-xs text-gray-500" title={caseItem.title}>
                                {caseItem.title}
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="w-[1px] whitespace-nowrap">{caseItem.category}</TableCell>
                        <TableCell className="w-[1px] whitespace-nowrap text-sm text-gray-600">{formatAssignmentLabel(caseItem)}</TableCell>
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

          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 tracking-tight">Notification History</h2>
            <NotificationPanel firmSlug={firmSlug} limit={8} />
          </section>


          <section className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-gray-900 tracking-tight">Help & Onboarding</h2>
              <Button variant="outline" onClick={handleReplayTour}>
                Replay product tour
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card className="space-y-4">
                <h3 className="text-base font-semibold text-gray-900">FAQ tutorial guide</h3>
                <div className="space-y-3">
                  {faqItems.map((item) => (
                    <div key={item.question} className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                      <h4 className="text-sm font-semibold text-gray-900">{item.question}</h4>
                      <p className="mt-1 text-sm text-gray-600">{item.answer}</p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="space-y-4">
                <h3 className="text-base font-semibold text-gray-900">Support & feedback</h3>
                <p className="text-sm text-gray-600">
                  Need implementation help, training, or want to share feedback? Reach out to the Docketra team.
                </p>
                <a
                  href={`mailto:${DEFAULT_SUPPORT_EMAIL}?subject=${encodeURIComponent('Docketra Support & Feedback')}`}
                  className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-all duration-200 ease-in-out hover:brightness-110 active:brightness-90"
                >
                  Write to support
                </a>
                <p className="text-xs text-gray-500">This will open your default email app with a pre-filled support subject.</p>
              </Card>
            </div>
          </section>
        </div>
      </div>

      {showProductTour ? createPortal(
        <div className="fixed inset-0 z-[1001] flex min-h-screen items-center justify-center bg-slate-950/50 px-4">
          <div className="w-full max-w-2xl rounded-xl border border-gray-200 bg-white p-6 shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
              Product tour · Step {tourStepIndex + 1} of {productTourSteps.length}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-gray-900">
              {productTourSteps[tourStepIndex]?.title}
            </h2>
            <p className="mt-3 text-sm text-gray-600">
              {productTourSteps[tourStepIndex]?.description}
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <button className="btn btn-secondary" onClick={markTourCompleted}>
                Skip tour
              </button>
              <div className="flex items-center gap-2">
                <button
                  className="btn btn-secondary"
                  onClick={() => setTourStepIndex((current) => Math.max(0, current - 1))}
                  disabled={tourStepIndex === 0}
                >
                  Back
                </button>
                <button className="btn btn-primary" onClick={handleTourNext}>
                  {tourStepIndex === productTourSteps.length - 1 ? 'Finish' : 'Next'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}

      {showBookmarkPrompt ? createPortal(
        <div className="fixed inset-0 z-[1000] flex min-h-screen items-center justify-center bg-slate-950/40 px-4">
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
        </div>,
        document.body,
      ) : null}
    </Layout>
  );
};
