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
import { PageHeader } from '../components/layout/PageHeader';
import { EmptyState } from '../components/layout/EmptyState';
import { PriorityPill } from '../components/common/PriorityPill';
import { SetupChecklist } from '../components/onboarding/SetupChecklist';
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
import './DashboardPage.css';

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

  const activateWithKeyboard = (event, action) => {
    if (event.key === ' ') {
      event.preventDefault();
      action();
    }

    if (event.key === 'Enter') {
      action();
    }
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
      let casesToDisplay = [];
      
      if (isAdmin) {
        try {
          const casesResponse = await caseService.getCases({ limit: DASHBOARD_RECENT_CASES_LIMIT });
          if (casesResponse.success) {
            casesToDisplay = casesResponse.data || [];
          }
        } catch (error) {
          console.error('Failed to load firm cases:', error);
          reportLoadWarning('Recent cases');
        }
      } else {
        try {
          const worklistResponse = await worklistService.getEmployeeWorklist({ limit: DASHBOARD_RECENT_CASES_LIMIT });
          if (worklistResponse.success) {
            casesToDisplay = worklistResponse.data || [];
          }
        } catch (error) {
          console.error('Failed to load worklist:', error);
          reportLoadWarning('Recent cases');
        }
      }
      
      setRecentCases(getRecentCasesSnapshot(casesToDisplay));

      const userFirmId = user?.firmId || user?.firm?.id;
      if (userFirmId) {
        try {
          const metricsResponse = await metricsService.getFirmMetrics(userFirmId);
          if (metricsResponse.success) {
            setStats((prev) => ({
              ...prev,
              ...metricsResponse.data,
            }));
          }
        } catch (error) {
          console.error('Failed to load firm metrics:', error);
          reportLoadWarning('Firm metrics');
        }
      }
      
      // My Open Cases
      try {
        const worklistResponse = await worklistService.getEmployeeWorklist();
        if (worklistResponse.success) {
          setStats((prev) => ({ ...prev, myOpenCases: (worklistResponse.data || []).length }));
        }
      } catch (error) {
        console.error('Failed to load open cases count:', error);
        reportLoadWarning('Open case counts');
      }
      
      // My Pending Cases (SLA risk)
      try {
        const pendingResponse = await api.get('/cases/my-pending');
        if (pendingResponse.data.success) {
          setStats((prev) => ({ ...prev, myPendingCases: (pendingResponse.data.data || []).length }));
        }
      } catch (error) {
        console.error('Failed to load pending cases:', error);
        reportLoadWarning('Pending case counts');
      }
      
      // My Resolved Cases
      try {
        const resolvedResponse = await caseService.getMyResolvedCases();
        if (resolvedResponse.success) {
          setStats((prev) => ({ ...prev, myResolvedCases: (resolvedResponse.data || []).length }));
        }
      } catch (error) {
        console.error('Failed to load resolved cases:', error);
        reportLoadWarning('Resolved case counts');
      }
      
      // My Unassigned Created Cases
      try {
        const unassignedCreatedResponse = await caseService.getMyUnassignedCreatedCases();
        if (unassignedCreatedResponse.success) {
          setStats((prev) => ({ ...prev, myUnassignedCreatedCases: (unassignedCreatedResponse.data || []).length }));
        }
      } catch (error) {
        console.error('Failed to load unassigned created cases:', error);
        reportLoadWarning('Unassigned case counts');
      }
      
      // Admin stats
      if (isAdmin) {
        try {
          const approvalsResponse = await adminService.getPendingApprovals();
          if (approvalsResponse.success) {
            setStats((prev) => ({ ...prev, adminPendingApprovals: approvalsResponse.data?.length || 0 }));
          }
        } catch (error) {
          console.error('Failed to load pending approvals:', error);
          reportLoadWarning('Pending approvals');
        }
        
        try {
          const filedResponse = await api.get('/admin/cases/filed');
          if (filedResponse.data.success) {
            setStats((prev) => ({ ...prev, adminFiledCases: filedResponse.data.pagination?.total || 0 }));
          }
        } catch (error) {
          console.error('Failed to load filed cases:', error);
          reportLoadWarning('Filed cases');
        }
        
        try {
          const adminResolvedResponse = await adminService.getAllResolvedCases();
          if (adminResolvedResponse.success) {
            setStats((prev) => ({ ...prev, adminResolvedCases: adminResolvedResponse.pagination?.total || 0 }));
          }
        } catch (error) {
          console.error('Failed to load admin resolved cases:', error);
          reportLoadWarning('Resolved admin cases');
        }

        // Active Clients
        try {
          const clientsResponse = await clientService.getClients(true);
          if (clientsResponse.success) {
            setStats((prev) => ({ ...prev, activeClients: (clientsResponse.data || []).length }));
          }
        } catch (error) {
          console.error('Failed to load active clients:', error);
          reportLoadWarning('Client counts');
        }
      }
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

  return (
    <Layout>
      <div className="dashboard">
        {/* Header */}
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
          <div className="dashboard__warning" role="status" aria-live="polite">
            <div>
              <strong>Some dashboard data could not be loaded.</strong>
              <p>
                Metrics may be incomplete right now. Retry to refresh the latest workload and compliance signals.
              </p>
            </div>
            <Button variant="outline" onClick={loadDashboardData}>
              Retry
            </Button>
          </div>
        ) : null}

        {/* Section 1: KPI Strip */}
        <div className="dashboard__kpi-strip">
          {/* Open Cases */}
          <div
            className="dashboard__kpi-card dashboard__kpi-card--clickable"
            onClick={() => navigate(`/app/firm/${firmSlug}/my-worklist?status=OPEN`)}
            onKeyDown={(event) => activateWithKeyboard(event, () => navigate(`/app/firm/${firmSlug}/my-worklist?status=OPEN`))}
            role="button"
            tabIndex={0}
          >
             <div className="dashboard__kpi-number">{stats.overdueComplianceItems}</div>
             <div className="dashboard__kpi-label">Overdue Compliance Items</div>
             <div className="dashboard__kpi-sub" style={{ color: 'var(--danger)' }}>Red Risk Band</div>
           </div>

          {/* Pending Approvals */}
          <div
            className="dashboard__kpi-card dashboard__kpi-card--clickable dashboard__kpi-card--accent"
            onClick={() => navigate(`/app/firm/${firmSlug}/cases?approvalStatus=PENDING`)}
            onKeyDown={(event) => activateWithKeyboard(event, () => navigate(`/app/firm/${firmSlug}/cases?approvalStatus=PENDING`))}
            role="button"
            tabIndex={0}
          >
            <div className="dashboard__kpi-number">
               {stats.dueInSevenDays}
             </div>
             <div className="dashboard__kpi-label">Due in 7 Days</div>
             <div className="dashboard__kpi-sub" style={{ color: 'var(--warning)' }}>Amber Risk Band</div>
           </div>

          {/* SLA Breaches (cases on hold / pended) */}
          <div
            className="dashboard__kpi-card dashboard__kpi-card--clickable dashboard__kpi-card--warning"
            onClick={() => navigate(`/app/firm/${firmSlug}/my-worklist?status=PENDED`)}
            onKeyDown={(event) => activateWithKeyboard(event, () => navigate(`/app/firm/${firmSlug}/my-worklist?status=PENDED`))}
            role="button"
            tabIndex={0}
          >
             <div className="dashboard__kpi-number">{awaitingPartnerReview}</div>
             <div className="dashboard__kpi-label">Awaiting Partner Review</div>
             <div className="dashboard__kpi-sub">Approval queue</div>
           </div>

          {/* Active Clients (admin) / Resolved Cases (regular user) */}
          {isAdmin ? (
              <div
                className="dashboard__kpi-card dashboard__kpi-card--clickable dashboard__kpi-card--success"
                onClick={() => navigate(`/app/firm/${firmSlug}/admin`)}
                onKeyDown={(event) => activateWithKeyboard(event, () => navigate(`/app/firm/${firmSlug}/admin`))}
                role="button"
                tabIndex={0}
              >
                <div className="dashboard__kpi-number">{stats.activeClients}</div>
                <div className="dashboard__kpi-label">Active Reporting Entities</div>
                <div className="dashboard__kpi-sub">Total active reporting entities</div>
              </div>
          ) : (
              <div
                className="dashboard__kpi-card dashboard__kpi-card--clickable dashboard__kpi-card--success"
                onClick={() => navigate(`/app/firm/${firmSlug}/my-worklist?status=RESOLVED`)}
                onKeyDown={(event) => activateWithKeyboard(event, () => navigate(`/app/firm/${firmSlug}/my-worklist?status=RESOLVED`))}
                role="button"
                tabIndex={0}
              >
               <div className="dashboard__kpi-number">{stats.myResolvedCases}</div>
               <div className="dashboard__kpi-label">Risk Summary Panel</div>
               <div className="dashboard__kpi-sub">Executed compliance items</div>
             </div>
          )}
        </div>

        {/* Section 2: Case Workflow Summary */}
        <div className="dashboard__section">
          <h2 className="dashboard__section-title">Case Lifecycle Distribution</h2>
          <div className="dashboard__workflow">
            {workflowStatuses.map((item, idx) => (
              <React.Fragment key={item.label}>
                <div className="dashboard__workflow-step">
                  <div
                    className="dashboard__workflow-count"
                    style={{ color: item.color, borderColor: item.color }}
                  >
                    {item.count}
                  </div>
                  <div className="dashboard__workflow-label">{item.label}</div>
                </div>
                {idx < workflowStatuses.length - 1 && (
                  <div className="dashboard__workflow-arrow">›</div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Section 3: Worklist Panel */}
        <div className="dashboard__section">
          <div className="dashboard__section-header">
            <h2 className="dashboard__section-title">
               Recent Cases
            </h2>
            <Button
              variant="outline"
              className="dashboard__view-all-button"
              onClick={handleViewAllCases}
            >
              View All Cases
            </Button>
          </div>
          <Card>
            {recentCasesLoading ? (
              <div className="dashboard__recent-cases-skeleton" aria-busy="true" aria-live="polite">
                {Array.from({ length: DASHBOARD_RECENT_CASES_LIMIT }).map((_, index) => (
                  <div key={index} className="dashboard__recent-cases-skeleton-row">
                    <SkeletonBlock style={{ width: '100%', height: '14px' }} />
                    <SkeletonBlock style={{ width: '80%', height: '14px' }} />
                    <SkeletonBlock style={{ width: '72%', height: '14px' }} />
                    <SkeletonBlock style={{ width: '64%', height: '14px' }} />
                    <SkeletonBlock style={{ width: '58%', height: '14px' }} />
                  </div>
                ))}
              </div>
            ) : recentCases.length === 0 ? (
              <EmptyState
                title={isAdmin ? 'No cases yet' : 'No assigned cases yet'}
                description={
                  isAdmin
                    ? 'Create your first case to start tracking deadlines, ownership, and firm workflow health.'
                    : 'Once work is assigned to you, your recently updated cases will appear here for quick follow-up.'
                }
                actionLabel={UX_COPY.actions.CREATE_CASE}
                onAction={() => navigate(`/app/firm/${firmSlug}/cases/create`)}
              />
            ) : (
              <div className="dashboard__table-wrap">
                <table className="neo-table dashboard__recent-cases-table" aria-label="Recent cases">
                  <thead>
                    <tr>
                      <th>Case Name</th>
                      <th>Category</th>
                      <th>Status</th>
                      <th>Priority</th>
                      <th>Last Action Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentCases.map((caseItem) => (
                      <tr
                        key={caseItem._id}
                        onClick={() => handleCaseClick(caseItem.caseId)}
                        onKeyDown={(event) => activateWithKeyboard(event, () => handleCaseClick(caseItem.caseId))}
                        tabIndex={0}
                      >
                        <td className="dashboard__case-name-cell">
                          <span className="dashboard__case-name" title={caseItem.caseName}>
                            {caseItem.caseName}
                          </span>
                        </td>
                        <td>{caseItem.category}</td>
                        <td>
                          <Badge status={caseItem.status}>{getStatusLabel(caseItem.status)}</Badge>
                        </td>
                        <td><PriorityPill caseRecord={caseItem} /></td>
                        <td>{formatDate(caseItem.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Admin extended stats */}
        {isAdmin && (
          <div className="dashboard__section">
            <h2 className="dashboard__section-title">Execution Status by Team Member</h2>
            <div className="dashboard__admin-stats">
              <div
                className="dashboard__stat-card dashboard__stat-card--clickable"
                onClick={() => navigate(`/app/firm/${firmSlug}/cases?status=FILED`)}
                onKeyDown={(event) => activateWithKeyboard(event, () => navigate(`/app/firm/${firmSlug}/cases?status=FILED`))}
                role="button"
                tabIndex={0}
              >
                <div className="dashboard__stat-value">{stats.adminFiledCases}</div>
                <div className="dashboard__stat-label">Filed Cases</div>
                <div className="dashboard__stat-description">Archived cases</div>
              </div>
              <div
                className="dashboard__stat-card dashboard__stat-card--clickable"
                onClick={() => navigate(`/app/firm/${firmSlug}/cases?status=RESOLVED`)}
                onKeyDown={(event) => activateWithKeyboard(event, () => navigate(`/app/firm/${firmSlug}/cases?status=RESOLVED`))}
                role="button"
                tabIndex={0}
              >
                <div className="dashboard__stat-value">{stats.adminResolvedCases}</div>
                <div className="dashboard__stat-label">All Resolved</div>
                <div className="dashboard__stat-description">All executed cases</div>
              </div>
              <div
                className="dashboard__stat-card dashboard__stat-card--clickable"
                onClick={() => navigate(`/app/firm/${firmSlug}/global-worklist?createdBy=me&status=UNASSIGNED`)}
                onKeyDown={(event) => activateWithKeyboard(event, () => navigate(`/app/firm/${firmSlug}/global-worklist?createdBy=me&status=UNASSIGNED`))}
                role="button"
                tabIndex={0}
              >
                <div className="dashboard__stat-value">{stats.myUnassignedCreatedCases}</div>
                <div className="dashboard__stat-label">Unassigned</div>
                <div className="dashboard__stat-description">Needs assignment</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bookmark Prompt Modal */}
      {showBookmarkPrompt && (
        <div className="dashboard__modal-overlay">
          <div className="dashboard__modal">
            <h2 className="dashboard__modal-title">Bookmark Your Firm Dashboard</h2>
            <p className="dashboard__modal-text">
              For quick access in the future, we recommend bookmarking this page:
            </p>
            <div className="dashboard__modal-url">
              {window.location.origin}/app/firm/{firmSlug}
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleDismissBookmarkPrompt}>
              Got it
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
};
