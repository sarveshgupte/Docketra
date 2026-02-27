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
import { Loading } from '../components/common/Loading';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { caseService } from '../services/caseService';
import { worklistService } from '../services/worklistService';
import { adminService } from '../services/adminService';
import { clientService } from '../services/clientService';
import { formatDate } from '../utils/formatters';
import api from '../services/api';
import './DashboardPage.css';

export const DashboardPage = () => {
  const { user } = useAuth();
  const { isAdmin } = usePermissions();
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
  });
  const [recentCases, setRecentCases] = useState([]);
  const [showBookmarkPrompt, setShowBookmarkPrompt] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

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
    setLoading(true);
    try {
      let casesToDisplay = [];
      
      if (isAdmin) {
        try {
          const casesResponse = await caseService.getCases({ limit: 5 });
          if (casesResponse.success) {
            casesToDisplay = (casesResponse.data || []).slice(0, 5);
          }
        } catch (error) {
          console.error('Failed to load firm cases:', error);
        }
      } else {
        try {
          const worklistResponse = await worklistService.getEmployeeWorklist();
          if (worklistResponse.success) {
            casesToDisplay = (worklistResponse.data || []).slice(0, 5);
          }
        } catch (error) {
          console.error('Failed to load worklist:', error);
        }
      }
      
      setRecentCases(casesToDisplay);
      
      // My Open Cases
      try {
        const worklistResponse = await worklistService.getEmployeeWorklist();
        if (worklistResponse.success) {
          setStats((prev) => ({ ...prev, myOpenCases: (worklistResponse.data || []).length }));
        }
      } catch (error) {
        console.error('Failed to load open cases count:', error);
      }
      
      // My Pending Cases (SLA risk)
      try {
        const pendingResponse = await api.get('/cases/my-pending');
        if (pendingResponse.data.success) {
          setStats((prev) => ({ ...prev, myPendingCases: (pendingResponse.data.data || []).length }));
        }
      } catch (error) {
        console.error('Failed to load pending cases:', error);
      }
      
      // My Resolved Cases
      try {
        const resolvedResponse = await caseService.getMyResolvedCases();
        if (resolvedResponse.success) {
          setStats((prev) => ({ ...prev, myResolvedCases: (resolvedResponse.data || []).length }));
        }
      } catch (error) {
        console.error('Failed to load resolved cases:', error);
      }
      
      // My Unassigned Created Cases
      try {
        const unassignedCreatedResponse = await caseService.getMyUnassignedCreatedCases();
        if (unassignedCreatedResponse.success) {
          setStats((prev) => ({ ...prev, myUnassignedCreatedCases: (unassignedCreatedResponse.data || []).length }));
        }
      } catch (error) {
        console.error('Failed to load unassigned created cases:', error);
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
        }
        
        try {
          const filedResponse = await api.get('/admin/cases/filed');
          if (filedResponse.data.success) {
            setStats((prev) => ({ ...prev, adminFiledCases: filedResponse.data.pagination?.total || 0 }));
          }
        } catch (error) {
          console.error('Failed to load filed cases:', error);
        }
        
        try {
          const adminResolvedResponse = await adminService.getAllResolvedCases();
          if (adminResolvedResponse.success) {
            setStats((prev) => ({ ...prev, adminResolvedCases: adminResolvedResponse.pagination?.total || 0 }));
          }
        } catch (error) {
          console.error('Failed to load admin resolved cases:', error);
        }

        // Active Clients
        try {
          const clientsResponse = await clientService.getClients(true);
          if (clientsResponse.success) {
            setStats((prev) => ({ ...prev, activeClients: (clientsResponse.data || []).length }));
          }
        } catch (error) {
          console.error('Failed to load active clients:', error);
        }
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCaseClick = (caseId) => {
    navigate(`/f/${firmSlug}/cases/${caseId}`);
  };

  if (loading) {
    return (
      <Layout>
        <Loading message="Loading dashboard..." />
      </Layout>
    );
  }

  // Workflow status pipeline data
  const workflowStatuses = [
    { label: 'Open', count: stats.myOpenCases, color: 'var(--color-primary)' },
    { label: 'Pending', count: stats.myPendingCases, color: 'var(--warning)' },
    { label: 'Resolved', count: stats.myResolvedCases, color: 'var(--color-success)' },
    { label: 'Unassigned', count: stats.myUnassignedCreatedCases, color: 'var(--text-muted)' },
  ];

  return (
    <Layout>
      <div className="dashboard">
        {/* Header */}
        <div className="dashboard__header">
          <h1 className="dashboard__title">Dashboard</h1>
          <p className="dashboard__subtitle">Welcome back, {user?.name || user?.xID}</p>
        </div>

        {/* Section 1: KPI Strip */}
        <div className="dashboard__kpi-strip">
          {/* Open Cases */}
          <div
            className="dashboard__kpi-card dashboard__kpi-card--clickable"
            onClick={() => navigate(`/f/${firmSlug}/my-worklist?status=OPEN`)}
          >
            <div className="dashboard__kpi-number">{stats.myOpenCases}</div>
            <div className="dashboard__kpi-label">Open Cases</div>
            <div className="dashboard__kpi-sub">In My Worklist</div>
          </div>

          {/* Pending Approvals */}
          <div
            className="dashboard__kpi-card dashboard__kpi-card--clickable dashboard__kpi-card--accent"
            onClick={() => navigate(`/f/${firmSlug}/cases?approvalStatus=PENDING`)}
          >
            <div className="dashboard__kpi-number">
              {isAdmin ? stats.adminPendingApprovals : stats.myPendingCases}
            </div>
            <div className="dashboard__kpi-label">Pending Approvals</div>
            <div className="dashboard__kpi-sub">Awaiting review</div>
          </div>

          {/* SLA Breaches (cases on hold / pended) */}
          <div
            className="dashboard__kpi-card dashboard__kpi-card--clickable dashboard__kpi-card--warning"
            onClick={() => navigate(`/f/${firmSlug}/my-worklist?status=PENDED`)}
          >
            <div className="dashboard__kpi-number">{stats.myPendingCases}</div>
            <div className="dashboard__kpi-label">SLA Risk</div>
            <div className="dashboard__kpi-sub">Cases on hold</div>
          </div>

          {/* Active Clients (admin) / Resolved Cases (regular user) */}
          {isAdmin ? (
            <div
              className="dashboard__kpi-card dashboard__kpi-card--clickable dashboard__kpi-card--success"
              onClick={() => navigate(`/f/${firmSlug}/admin`)}
            >
              <div className="dashboard__kpi-number">{stats.activeClients}</div>
              <div className="dashboard__kpi-label">Active Clients</div>
              <div className="dashboard__kpi-sub">Registered clients</div>
            </div>
          ) : (
            <div
              className="dashboard__kpi-card dashboard__kpi-card--clickable dashboard__kpi-card--success"
              onClick={() => navigate(`/f/${firmSlug}/my-worklist?status=RESOLVED`)}
            >
              <div className="dashboard__kpi-number">{stats.myResolvedCases}</div>
              <div className="dashboard__kpi-label">Resolved Cases</div>
              <div className="dashboard__kpi-sub">Successfully completed</div>
            </div>
          )}
        </div>

        {/* Section 2: Case Workflow Summary */}
        <div className="dashboard__section">
          <h2 className="dashboard__section-title">Case Workflow</h2>
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
              {isAdmin ? 'Recent Firm Cases' : 'My Recent Cases'}
            </h2>
            <button
              className="btn btn-secondary"
              onClick={() => navigate(`/f/${firmSlug}/cases/create`)}
              style={{ fontSize: 'var(--font-size-sm)' }}
            >
              + Create Case
            </button>
          </div>
          <Card>
            {recentCases.length === 0 ? (
              <div className="dashboard__empty">
                <div className="dashboard__empty-icon" role="img" aria-label="No cases">📋</div>
                <h3 className="dashboard__empty-title">No cases yet</h3>
                <p className="dashboard__empty-description text-secondary">
                  {isAdmin
                    ? 'Your firm has no cases yet. Create the first one to get started.'
                    : 'You have no assigned cases yet. Check the global worklist or create a new case.'}
                </p>
                <button
                  className="btn btn-primary dashboard__empty-cta"
                  onClick={() => navigate(`/f/${firmSlug}/cases/create`)}
                >
                  {isAdmin ? 'Create Your First Case' : 'Create a Case'}
                </button>
              </div>
            ) : (
              <table className="neo-table">
                <thead>
                  <tr>
                    <th>Case Name</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {recentCases.map((caseItem) => (
                    <tr key={caseItem._id} onClick={() => handleCaseClick(caseItem.caseId)}>
                      <td>{caseItem.caseName}</td>
                      <td>{caseItem.category}</td>
                      <td>
                        <Badge status={caseItem.status}>{caseItem.status}</Badge>
                      </td>
                      <td>{formatDate(caseItem.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        {/* Admin extended stats */}
        {isAdmin && (
          <div className="dashboard__section">
            <h2 className="dashboard__section-title">Firm Overview</h2>
            <div className="dashboard__admin-stats">
              <div
                className="dashboard__stat-card dashboard__stat-card--clickable"
                onClick={() => navigate(`/f/${firmSlug}/cases?status=FILED`)}
              >
                <div className="dashboard__stat-value">{stats.adminFiledCases}</div>
                <div className="dashboard__stat-label">Filed Cases</div>
                <div className="dashboard__stat-description">Archived cases</div>
              </div>
              <div
                className="dashboard__stat-card dashboard__stat-card--clickable"
                onClick={() => navigate(`/f/${firmSlug}/cases?status=RESOLVED`)}
              >
                <div className="dashboard__stat-value">{stats.adminResolvedCases}</div>
                <div className="dashboard__stat-label">All Resolved</div>
                <div className="dashboard__stat-description">All completed cases</div>
              </div>
              <div
                className="dashboard__stat-card dashboard__stat-card--clickable"
                onClick={() => navigate(`/f/${firmSlug}/global-worklist?createdBy=me&status=UNASSIGNED`)}
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
              {window.location.origin}/f/{firmSlug}
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
