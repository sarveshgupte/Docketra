/**
 * Reports Dashboard Page
 * MIS Dashboard with metric cards
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../../components/common/Layout';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/layout/PageHeader';
import { DashboardSkeleton } from '../../components/common/Skeleton';
import { MetricCard } from '../../components/reports/MetricCard';
import { AuditLogView } from '../../components/reports/AuditLogView';
import { useAuth } from '../../hooks/useAuth';
import { reportsService } from '../../services/reports.service';
import './ReportsDashboard.css';

export const ReportsDashboard = () => {
  const navigate = useNavigate();
  const { firmSlug } = useParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);
  const [pendingReport, setPendingReport] = useState(null);
  const [slaWeeklySummary, setSlaWeeklySummary] = useState(null);
  const [error, setError] = useState(null);
  const hasAnyReportData = (
    (metrics && Object.keys(metrics).length > 0) ||
    (pendingReport && Object.keys(pendingReport).length > 0) ||
    (slaWeeklySummary && Object.keys(slaWeeklySummary).length > 0)
  );

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Load case metrics
      const metricsResponse = await reportsService.getCaseMetrics();
      if (metricsResponse.data.success) {
        setMetrics(metricsResponse.data.data);
      }

      // Load pending cases report
      const pendingResponse = await reportsService.getPendingCases();
      if (pendingResponse.data.success) {
        setPendingReport(pendingResponse.data.data);
      }

      const slaResponse = await reportsService.getSlaWeeklySummary();
      if (slaResponse.data.success) {
        setSlaWeeklySummary(slaResponse.data.data);
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      if (!err.response) {
        setError('Unable to connect to server');
      } else if (err.response?.status === 404) {
        setMetrics(null);
        setPendingReport(null);
      } else if (err.response?.status === 401 || err.response?.status === 403) {
        setError('You do not have permission');
      } else if (err.response?.status >= 500) {
        setError('Something went wrong. Please try again.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetailedReports = () => {
    navigate(`/app/firm/${firmSlug}/admin/reports/detailed`);
  };

  if (loading) {
    return (
      <Layout>
        <DashboardSkeleton />
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="reports-dashboard">
          <EmptyState
            title="We couldn’t load your reports"
            description={error}
            actionLabel="Try again"
            onAction={loadDashboardData}
          />
        </div>
      </Layout>
    );
  }

  if (!hasAnyReportData) {
    return (
      <Layout>
        <div className="reports-dashboard">
          <PageHeader
            title="Reports & MIS Dashboard"
            description="Management information system - Read-only view"
          />
          <EmptyState
            title="No reports available yet"
            description="Once cases and team activity start flowing, your reporting workspace will populate automatically."
            actionLabel="Review case registry"
            onAction={() => navigate(`/app/firm/${firmSlug}/dockets`)}
          />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="reports-dashboard">
        <PageHeader
          title="Reports & MIS Dashboard"
          description="Management information system - Read-only view"
        />

        <div className="reports-dashboard__grid">
          {/* Total Cases Card */}
          <MetricCard
            title="Total Cases"
            value={metrics?.totalCases || 0}
            subtitle={`Open: ${metrics?.byStatus?.Open || 0} | Pending: ${metrics?.byStatus?.Pending || 0} | Closed: ${metrics?.byStatus?.Closed || 0}`}
            onClick={handleViewDetailedReports}
          />

          {/* Pending Cases Card */}
          <MetricCard
            title="Pending Cases"
            value={pendingReport?.totalPending || 0}
            subtitle={`Critical: ${pendingReport?.byAgeing?.['30+ days'] || 0} overdue`}
            warning={pendingReport?.byAgeing?.['30+ days'] > 0}
            onClick={handleViewDetailedReports}
          />

          <MetricCard
            title="Weekly SLA Summary"
            value={slaWeeklySummary?.currentlyOverdue || 0}
            subtitle={`Due soon: ${slaWeeklySummary?.dueSoon || 0} | Within SLA: ${slaWeeklySummary?.resolvedWithinSla || 0}`}
            warning={(slaWeeklySummary?.currentlyOverdue || 0) > 0 || (slaWeeklySummary?.resolvedAfterBreach || 0) > 0}
            onClick={handleViewDetailedReports}
          />

          {/* Top Categories Card */}
          <div className="reports-dashboard__card">
            <h3>Top Categories</h3>
            {metrics?.byCategory && Object.keys(metrics.byCategory).length > 0 ? (
              <table className="reports-dashboard__table">
                <tbody>
                  {Object.entries(metrics.byCategory)
                    .slice(0, 5)
                    .map(([category, count]) => (
                      <tr key={category}>
                        <td>{category}</td>
                        <td className="reports-dashboard__count">{count}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            ) : (
              <EmptyState
                title="No category data"
                description="Category trends will appear when dockets are categorized."
              />
            )}
          </div>

          {/* Top Clients Card */}
          <div className="reports-dashboard__card">
            <h3>Top Clients</h3>
            {metrics?.byClient && metrics.byClient.length > 0 ? (
              <table className="reports-dashboard__table">
                <tbody>
                  {metrics.byClient.slice(0, 5).map((client) => (
                    <tr key={client.clientId}>
                      <td>{client.clientName}</td>
                      <td className="reports-dashboard__count">{client.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState
                title="No client data"
                description="Client leaderboard data will appear once dockets are active."
              />
            )}
          </div>

          {/* Ageing Breakdown Card */}
          <div className="reports-dashboard__card">
            <h3>Pending Cases Ageing</h3>
            {pendingReport?.byAgeing ? (
              <table className="reports-dashboard__table">
                <tbody>
                  <tr>
                    <td>0-7 days</td>
                    <td className="reports-dashboard__count">{pendingReport.byAgeing['0-7 days'] || 0}</td>
                  </tr>
                  <tr>
                    <td>8-30 days</td>
                    <td className="reports-dashboard__count">{pendingReport.byAgeing['8-30 days'] || 0}</td>
                  </tr>
                  <tr>
                    <td>30+ days</td>
                    <td className="reports-dashboard__count reports-dashboard__count--warning">
                      {pendingReport.byAgeing['30+ days'] || 0}
                    </td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <EmptyState
                title="No ageing data"
                description="Pending ageing insights will appear when pending dockets exist."
              />
            )}
          </div>

          {/* Top Employees Card */}
          <div className="reports-dashboard__card">
            <h3>Top Employees by Cases</h3>
            {metrics?.byEmployee && metrics.byEmployee.length > 0 ? (
              <table className="reports-dashboard__table">
                <tbody>
                  {metrics.byEmployee.slice(0, 5).map((employee) => (
                    <tr key={employee.email}>
                      <td>{employee.name}</td>
                      <td className="reports-dashboard__count">{employee.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState
                title="No employee data"
                description="Team workload data will appear as team members process dockets."
              />
            )}
          </div>

          <AuditLogView />
        </div>

        <div className="reports-dashboard__actions">
          <button className="neo-button neo-button--primary" onClick={handleViewDetailedReports}>
            View Detailed Reports
          </button>
        </div>
      </div>
    </Layout>
  );
};
